import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import LoginRegister from './components/LoginRegister';
import UserProfile from './components/UserProfile';
import './App.css';

const API_BASE = "http://localhost:8000";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // [新增] 驗證狀態
  const [page, setPage] = useState('upload');
  const [mode, setMode] = useState('table');
  const [target, setTarget] = useState('person');
  const [modelLabels, setModelLabels] = useState([]); // [新增] 存放所有類別名稱
  const [refreshRate, setRefreshRate] = useState(200);
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({});
  const [videoSrc, setVideoSrc] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  // [Fix] 使用 Ref 解決 WebSocket 閉包導致的 stale state 問題
  const modeRef = useRef(mode);
  const targetRef = useRef(target);

  // 同步 Ref 與 State 並重置統計
  useEffect(() => {
    modeRef.current = mode;
    targetRef.current = target;
    setCounts({}); // [新增] 切換模式或目標時重置統計
  }, [mode, target]);

  // 初始化 WebSocket
  useEffect(() => {
    const wsUrl = `ws://${new URL(API_BASE).host}/ws/video/`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // 加入這行看數據！
      console.log("後端回傳:", data.detections);

      // 改為累積邏輯：取最大值
      setCounts(prevCounts => {
        const newCounts = {};

        // 1. 初始化既有 Max 值，但 Current 歸零
        Object.keys(prevCounts).forEach(key => {
          // 注意：prevCounts[key] 可能是數字(舊邏輯)或物件(新邏輯)
          // 這裡做個防呆
          const oldMax = typeof prevCounts[key] === 'object' ? prevCounts[key].max : prevCounts[key];
          newCounts[key] = { current: 0, max: oldMax || 0 };
        });

        // 2. 獲取當前幀數據
        // 2. 計算即時偵測框數量 (Frontend Count)
        const detCounts = {};
        (data.detections || []).forEach(det => {
          detCounts[det.label] = (detCounts[det.label] || 0) + 1;
        });

        // 3. 合併 Backend counts 和 Frontend counts
        const backendCounts = data.all_counts || {};
        const allKeys = new Set([...Object.keys(backendCounts), ...Object.keys(detCounts)]);

        allKeys.forEach(key => {
          // [Fix] 過濾邏輯：如果是 single 模式，只處理目標物件
          if (modeRef.current === 'single' && key.toLowerCase() !== targetRef.current.toLowerCase()) {
            return;
          }

          // 取最大值作為當前幀的「可信數量」
          const valBackend = backendCounts[key] || 0;
          const valFrontend = detCounts[key] || 0;
          // 避免重複計算：取兩者最大值，而不是相加
          const currentVal = Math.max(valBackend, valFrontend);

          const oldMax = newCounts[key]?.max || 0;
          newCounts[key] = {
            current: currentVal,
            max: Math.max(currentVal, oldMax)
          };
        });

        return newCounts;
      });
      // setCounts(data.all_counts || {}); // 舊邏輯
      drawBoxes(data.detections || []);
    };

    socketRef.current.onopen = () => console.log("✅ WebSocket Connected");
    socketRef.current.onerror = (err) => console.error("❌ WebSocket Error:", err);

    // [新增] 獲取 YOLO 標籤清單
    axios.get(`${API_BASE}/labels/`)
      .then(res => {
        setModelLabels(res.data.labels);
      })
      .catch(err => console.error("無法獲取標籤:", err));

    fetchHistory();
    return () => socketRef.current?.close();
  }, []);

  // 影像控制邏輯
  const sendFrame = React.useCallback(() => {
    const video = videoRef.current;
    if (socketRef.current?.readyState === WebSocket.OPEN && video && video.videoWidth > 0) {
      if (video.paused || video.ended) return;

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = video.videoWidth;
      offscreenCanvas.height = video.videoHeight;
      const ctx = offscreenCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      socketRef.current.send(JSON.stringify({
        image: offscreenCanvas.toDataURL('image/jpeg', 0.5),
        target: target
      }));
    }
  }, [target]);

  useEffect(() => {
    // 切換頁面時重置統計
    setCounts({});

    if (page === 'live') {
      setVideoSrc(null);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(err => console.error("鏡頭開啟失敗:", err));
    } else if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    const timer = setInterval(sendFrame, refreshRate);
    return () => clearInterval(timer);
  }, [page, refreshRate, videoSrc, sendFrame]);

  const drawBoxes = (detections) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!canvas || !video) return;

    // 1. 獲取影片的「顯示尺寸」 (CSS 控制的大小)
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    // 2. 獲取影片的「原始尺寸」 (檔案本身的解析度)
    const originalWidth = video.videoWidth;
    const originalHeight = video.videoHeight;

    if (originalWidth === 0 || displayWidth === 0) return;

    // 3. 設定畫布的解析度等於「顯示尺寸」 (這很重要，確保畫布跟影片在視覺上一樣大)
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 4. 計算縮放比例
    const scaleX = displayWidth / originalWidth;
    const scaleY = displayHeight / originalHeight;

    detections.forEach(det => {
      // 模式過濾 [Fix] 改用 Ref 獲取最新狀態
      if (modeRef.current === 'single' && det.label.toLowerCase() !== targetRef.current.toLowerCase()) return;

      const [x1, y1, x2, y2] = det.box;

      // 5. 將原始座標轉換為顯示座標
      const _x1 = x1 * scaleX;
      const _y1 = y1 * scaleY;
      const _w = (x2 - x1) * scaleX;
      const _h = (y2 - y1) * scaleY;

      // 開始繪圖
      ctx.strokeStyle = '#00f2fe'; // 鮮豔的青色 (大師級配色)
      ctx.lineWidth = 3;
      ctx.strokeRect(_x1, _y1, _w, _h);

      // 繪製標籤
      ctx.fillStyle = 'rgba(0, 242, 254, 0.8)'; // 半透明背景
      ctx.font = 'bold 16px Arial';
      const label = `${det.label} ${Math.round(det.conf * 100)}%`;
      const textMetrics = ctx.measureText(label);

      ctx.fillRect(_x1, _y1 - 24, textMetrics.width + 10, 24);
      ctx.fillStyle = '#000';
      ctx.fillText(label, _x1 + 5, _y1 - 6);
    });
  };



  const resetStats = () => {
    setCounts({});
  };

  // ... (fetchHistory, handleUpload, deleteRecord 等維持不變)
  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history/`);
      setHistory(res.data.history || []);
    } catch (e) { console.error("History fetch error"); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoSrc(URL.createObjectURL(file));
    setPage('upload');
    const fd = new FormData();
    fd.append('video', file);
    await axios.post(`${API_BASE}/upload/`, fd);
    fetchHistory();
    resetStats(); // 重置表格
  };

  const deleteRecord = async (id) => {
    await axios.post(`${API_BASE}/delete/${id}/`);
    fetchHistory();
  };

  const selectHistoryVideo = (name) => {
    setVideoSrc(`${API_BASE}/media/${name}`);
    setPage('upload');
    resetStats(); // 重置表格
  };

  // [新增] Logout 處理
  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/logout/`, {}, { withCredentials: true });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      setIsAuthenticated(false);
      // 清除任何可能的狀態
      setVideoSrc(null);
      setPage('upload');
    }
  };

  // [新增] Delete Account 處理
  const handleDeleteAccount = async () => {
    if (!window.confirm("嚴重警告：您確定要刪除帳號嗎？此動作無法復原！\n\nWarning: Are you sure you want to delete your account? This cannot be undone!")) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE}/delete_account/`, { withCredentials: true });
      if (res.data.status === 'success') {
        alert("帳號已成功刪除。");
        handleLogout(); // 刪除後執行登出流程
      } else {
        alert("刪除失敗：" + res.data.message);
      }
    } catch (e) {
      console.error("Delete account error", e);
      alert("發生錯誤，無法刪除帳號。");
    }
  };

  if (!isAuthenticated) {
    return <LoginRegister onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">AI VISION PRO</div>
        <button className={page === 'upload' ? 'active' : ''} onClick={() => setPage('upload')}>影片分析室</button>
        <button className={page === 'live' ? 'active' : ''} onClick={() => setPage('live')}>實時監測站</button>
        {/* [新增] 個人資料按鈕 */}
        <button className={page === 'profile' ? 'active' : ''} onClick={() => setPage('profile')}>個人資料</button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '0 10px' }}>
          {/* [新增] 登出按鈕 */}
          <button className="logout-btn" onClick={handleLogout}>
            登出系統
          </button>
          {/* [新增] 刪除帳號按鈕 */}
          <button className="delete-account-btn" onClick={handleDeleteAccount}>
            刪除帳號
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="controls">
          <div className="group">
            <label>模式</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="table">表格模式</option>
              <option value="single">指定目標</option>
            </select>
          </div>
          {mode === 'single' && (
            <div className="group">
              <label>選擇目標</label>
              <select
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="target-select"
              >
                {modelLabels.length > 0 ? (
                  modelLabels.map((label, index) => (
                    <option key={index} value={label}>
                      {label}
                    </option>
                  ))
                ) : (
                  <option value="person">載入中...</option>
                )}
              </select>
            </div>
          )}
          <div className="group">
            <label>更新速度 {refreshRate}ms</label>
            <input type="range" min="50" max="1000" step="50" value={refreshRate} onChange={e => setRefreshRate(parseInt(e.target.value))} />
          </div>
        </header>

        <div className="content-layout">
          {page === 'profile' ? (
            <UserProfile onLogout={handleLogout} />
          ) : (
            <>
              <div className="video-section">
                <div className="video-wrapper">
                  <video ref={videoRef} src={videoSrc} autoPlay muted playsInline crossOrigin="anonymous" controls={page === 'upload'} />
                  {/* 重點：Canvas 在此，透過 CSS 絕對定位疊加 */}
                  <canvas ref={canvasRef} className="overlay-canvas" />
                </div>
                {page === 'upload' && (
                  <div className="upload-box card">
                    <input type="file" accept="video/*" onChange={handleUpload} id="upload-input" hidden />
                    <label htmlFor="upload-input" className="upload-label">點擊上傳本地資料</label>
                  </div>
                )}
              </div>

              <div className="data-section">
                <div className="card stats">
                  <div className="card-header">
                    <h3>實時統計數據</h3>
                    <button className="reset-btn" onClick={resetStats}>清除重置</button>
                  </div>
                  <div className="table-container">
                    <table className="stats-table">
                      <thead><tr><th>物體</th><th>目前數量</th><th>歷史最大</th></tr></thead>
                      <tbody>
                        {Object.entries(counts).length > 0 ?
                          Object.entries(counts).map(([k, v]) => (
                            <tr key={k}>
                              <td>{k}</td>
                              {/* 相容性處理：如果 v 是數字(舊數據)則顯示為 current */}
                              <td style={{ color: '#4facfe' }}>{typeof v === 'object' ? v.current : v}</td>
                              <td style={{ color: '#00f2fe', fontWeight: 'bold' }}>{typeof v === 'object' ? v.max : v}</td>
                            </tr>
                          )) :
                          <tr><td colSpan="3">等待偵測...</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
                {page === 'upload' && (
                  <div className="card history">
                    <h3>歷史紀錄管理</h3>
                    <div className="history-list">
                      {history.map(h => (
                        <div className="history-item" key={h.id} onClick={() => selectHistoryVideo(h.name)}>
                          <span>{h.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteRecord(h.id); }}>刪除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}