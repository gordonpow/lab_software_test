import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LoginRegister.css'; // Reuse styles for consistency

const API_BASE = "http://localhost:8000";

export default function UserProfile({ onLogout }) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        newPassword: ''
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${API_BASE}/profile/`, { withCredentials: true });
            if (res.data.status === 'success') {
                setFormData(prev => ({
                    ...prev,
                    username: res.data.data.username,
                    email: res.data.data.email
                }));
            }
        } catch (err) {
            console.error("Failed to fetch profile", err);
            setError("無法載入個人資料");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setMessage(null);
        setError(null);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                username: formData.username,
                email: formData.email,
                ...(formData.newPassword ? { password: formData.newPassword } : {})
            };

            const res = await axios.put(`${API_BASE}/profile/`, payload, { withCredentials: true });

            if (res.data.status === 'success') {
                setMessage("個人資料更新成功！");
                if (formData.newPassword) {
                    setMessage("更密碼成功，請重新整理頁面以確保安全。");
                    setFormData(prev => ({ ...prev, newPassword: '' }));
                }
            } else {
                setError(res.data.message || "更新失敗");
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "更新失敗，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container" style={{ position: 'relative', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="auth-card" style={{ maxWidth: '500px', width: '100%' }}>
                <div className="auth-header">
                    <h1 className="auth-title">個人資料設定</h1>
                    <div className="auth-subtitle">管理您的帳戶資訊</div>
                </div>

                {loading && <div className="text-center">載入中...</div>}

                {!loading && (
                    <form className="auth-form" onSubmit={handleUpdate}>
                        {message && <div className="success-msg" style={{ color: '#2ecc71', marginBottom: '1rem', textAlign: 'center' }}>{message}</div>}
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

                        <div className="input-group">
                            <input
                                type="email"
                                name="email"
                                placeholder=" "
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <label>電子郵件</label>
                        </div>

                        <div className="input-group">
                            <input
                                type="password"
                                name="newPassword"
                                placeholder=" "
                                value={formData.newPassword}
                                onChange={handleChange}
                            />
                            <label>新密碼 (若不修改請留空)</label>
                        </div>

                        <button type="submit" className="auth-btn" disabled={loading}>
                            {loading ? "處理中..." : "儲存變更"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
