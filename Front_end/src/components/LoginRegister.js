import React, { useState } from 'react';
import axios from 'axios';
import './LoginRegister.css';

const API_BASE = "http://localhost:8000";

export default function LoginRegister({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const endpoint = isLogin ? '/login/' : '/register/';

        try {
            // 設定 axios 發送 cookie，這對於 Django Session Auth 是必須的
            const config = {
                headers: {
                    'Content-Type': 'application/json'
                },
                withCredentials: true
            };

            const res = await axios.post(`${API_BASE}${endpoint}`, formData, config);

            if (res.data.status === 'success') {
                if (isLogin) {
                    onLogin(); // Django Session 登入成功，不需要 token，直接更新狀態
                } else {
                    setIsLogin(true); // 註冊成功，切換到登入頁面
                    setError("註冊成功！請登入"); // 借用 error 欄位顯示綠色訊息...或稍後優化
                    alert("註冊成功！請登入");
                    setFormData({ ...formData, password: '' });
                }
            } else {
                throw new Error(res.data.message || "操作失敗");
            }

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || "發生錯誤，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-title">AI VISION PRO</h1>
                    <div className="auth-subtitle">
                        {isLogin ? "歡迎回來，請登入系統" : "建立您的帳戶以開始使用"}
                    </div>
                </div>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => { setIsLogin(true); setError(null); }}
                    >
                        登入
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => { setIsLogin(false); setError(null); }}
                    >
                        註冊
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="error-msg">{error}</div>}

                    <div className="input-group">
                        <input
                            type="text"
                            name="username"
                            placeholder=" "
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                        <label>使用者名稱</label>
                    </div>

                    {!isLogin && (
                        <div className="input-group">
                            <input
                                type="email"
                                name="email"
                                placeholder=" "
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                            <label>電子郵件</label>
                        </div>
                    )}

                    <div className="input-group">
                        <input
                            type="password"
                            name="password"
                            placeholder=" "
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <label>密碼</label>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "處理中..." : (isLogin ? "進入系統" : "建立帳戶")}
                    </button>
                </form>

                <div className="auth-footer">
                    {isLogin ? (
                        <span>還沒有帳號？ <span className="link" onClick={() => setIsLogin(false)}>立即註冊</span></span>
                    ) : (
                        <span>已經有帳號？ <span className="link" onClick={() => setIsLogin(true)}>立即登入</span></span>
                    )}
                </div>
            </div>
        </div>
    );
}
