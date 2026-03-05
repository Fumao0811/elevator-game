import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

function Home({ appState }: Props) {
    const navigate = useNavigate();
    const [nameInput, setNameInput] = useState(appState.nickname);

    const handleStart = () => {
        if (!nameInput.trim()) {
            alert('ニックネームを入力してください');
            return;
        }
        appState.setNickname(nameInput.trim());
        navigate('/match');
    };

    return (
        <div className="screen-container">
            <div>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '8px', color: '#ff2a3a' }}>
                    ELEVATOR
                </h1>
                <p style={{ color: '#888', fontSize: '0.9rem', letterSpacing: '2px' }}>
                    心理戦コメディホラー
                </p>
            </div>

            <div style={{ width: '100%', maxWidth: '300px', marginTop: '40px' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="ニックネーム (3〜12文字)"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={12}
                />
            </div>

            <button className="btn" onClick={handleStart} style={{ marginTop: '20px', width: '200px' }}>
                対戦を開始する
            </button>

            <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 'auto' }}>
                ※ブラウザを閉じると進行状況はリセットされます
            </p>
        </div>
    );
}

export default Home;
