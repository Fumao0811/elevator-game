import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

function Home({ appState }: Props) {
    const navigate = useNavigate();
    const [nameInput, setNameInput] = useState(appState.nickname);
    const [roomCodeInput, setRoomCodeInput] = useState('');

    const handleStartFree = () => {
        if (!nameInput.trim()) {
            alert('ニックネームを入力してください');
            return;
        }
        appState.setNickname(nameInput.trim());
        navigate('/match');
    };

    const handleStartRoom = () => {
        if (!nameInput.trim()) {
            alert('ニックネームを入力してください');
            return;
        }
        if (!roomCodeInput.trim()) {
            alert('合言葉を入力してください');
            return;
        }
        appState.setNickname(nameInput.trim());
        navigate('/match', { state: { roomCode: roomCodeInput.trim() } });
    };

    return (
        <div className="screen-container" style={{ justifyContent: 'flex-start', paddingTop: '10vh', gap: '15px' }}>
            <div>
                <h1 className="horror-font-title fx-flicker" style={{ fontSize: '2.4rem', marginBottom: '10px', color: '#ff2a3a', textShadow: '0 0 15px red', whiteSpace: 'nowrap' }}>
                    DRAW & ESCAPE
                </h1>
                <p className="horror-font" style={{ color: '#aaa', fontSize: '1.2rem', letterSpacing: '4px' }}>
                    心理戦コメディホラー
                </p>
            </div>

            {/* ルール説明セクション */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '15px',
                marginTop: '15px',
                width: '100%',
                maxWidth: '360px',
                textAlign: 'left',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                color: '#ddd'
            }}>
                <p style={{ fontWeight: 'bold', color: '#ff4a5a', marginBottom: '10px', textAlign: 'center', fontSize: '1rem', letterSpacing: '2px' }}>【 ルール説明 】</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ margin: 0 }}><strong style={{ color: '#fff' }}>全5ラウンド（表・裏交替）</strong>の合計スコア勝負！</p>
                    <p style={{ margin: 0 }}><span style={{ color: '#4aff4a', fontWeight: 'bold' }}>逃げる側(中)</span>：1〜5階から逃げる！<br /><span style={{ fontSize: '0.75rem', color: '#ffaaaa', marginLeft: '1.5rem', fontWeight: 'bold' }}>※逃げる側が前回選んだ階は両者選べません</span></p>
                    <p style={{ margin: 0 }}><span style={{ color: '#ff4a5a', fontWeight: 'bold' }}>待ち伏せ(外)</span>：相手が降りる階を予想して待ち伏せる！</p>
                    <p style={{ margin: 0 }}><strong style={{ color: '#fff' }}>おばけの絵(30秒)</strong>：捕まえた時に相手を驚かす絵を描く！<br /><strong style={{ color: '#fff' }}>階層選択(30秒)</strong>：時間切れになるとランダム選択！<br />捕まると……描いた絵が相手を襲う！</p>
                </div>
            </div>

            <div style={{ width: '100%', maxWidth: '320px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                    <span style={{ color: '#aaa', fontSize: '0.85rem', display: 'block', marginBottom: '5px', textAlign: 'left', fontWeight: 'bold' }}>1. ニックネームを入力</span>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="ニックネーム (1〜12文字)"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        maxLength={12}
                        style={{ textAlign: 'center', fontWeight: 'bold' }}
                    />
                </div>

                <div style={{ borderTop: '1px solid #333', paddingTop: '15px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <span style={{ color: '#aaa', fontSize: '0.85rem', display: 'block', marginBottom: '8px', textAlign: 'left', fontWeight: 'bold' }}>2. モードを選択して対戦</span>
                        
                        {/* フリーマッチボタン */}
                        <button
                            onClick={handleStartFree}
                            style={{
                                width: '100%',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                padding: '12px',
                                backgroundColor: '#8b0000',
                                border: '2px solid #ff4a5a',
                                borderRadius: '8px',
                                boxShadow: '0 0 15px rgba(255, 42, 58, 0.4), inset 0 0 10px rgba(0,0,0,0.8)',
                                color: '#fff',
                                textShadow: '2px 2px 4px #000',
                                letterSpacing: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '10px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#a00000'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b0000'}
                        >
                            フリーマッチを開始
                        </button>
                    </div>

                    {/* ルームマッチ入力エリア */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid #222',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        textAlign: 'left'
                    }}>
                        <span style={{ color: '#999', fontSize: '0.8rem', fontWeight: 'bold' }}>ルームマッチ（合言葉）</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="合言葉 (例: 1234)"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value)}
                                maxLength={10}
                                style={{ textAlign: 'center', fontSize: '0.9rem', height: '38px', padding: '5px', flex: 1 }}
                            />
                            <button
                                onClick={handleStartRoom}
                                style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    padding: '0 15px',
                                    height: '38px',
                                    backgroundColor: '#1a1a1a',
                                    border: '2px solid #555',
                                    borderRadius: '8px',
                                    color: '#ddd',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.borderColor = '#888';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#ddd';
                                    e.currentTarget.style.borderColor = '#555';
                                }}
                            >
                                入室
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 'auto' }}>
                ※ブラウザを閉じると進行状況はリセットされます
            </p>
        </div>
    );
}

export default Home;
