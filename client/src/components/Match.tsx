import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

const Match: React.FC<Props> = ({ appState }) => {
    const navigate = useNavigate();
    const [statusText, setStatusText] = useState('サーバーに接続中...');
    const { socket, nickname } = appState;

    useEffect(() => {
        if (!socket || !nickname) {
            navigate('/');
            return;
        }

        // サーバーにマッチングリクエストを送信
        socket.emit('join_random_match', nickname);

        // 待機中イベントのハンドリング
        socket.on('waiting_for_match', () => {
            setStatusText('対戦相手を探しています...');
        });

        // マッチング成功イベントのハンドリング
        const handleMatchFound = () => {
            navigate('/battle');
        };
        socket.on('match_found', handleMatchFound);

        return () => {
            socket.off('waiting_for_match');
            socket.off('match_found', handleMatchFound);
        };
    }, [socket, nickname, navigate]);

    return (
        <div className="screen-container">
            <h2 style={{ color: '#fff' }}>MATCHING</h2>

            <div className="fx-flicker" style={{ margin: '40px 0' }}>
                <div style={{
                    width: '60px', height: '60px',
                    border: '4px solid #333',
                    borderTopColor: '#d11a2a',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            </div>

            <p className="status-text">{statusText}</p>

            <button
                className="btn"
                onClick={() => navigate('/')}
                style={{ marginTop: '30px', backgroundColor: '#333', color: '#aaa', boxShadow: 'none' }}
            >
                キャンセル
            </button>

            <style>
                {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
            </style>
        </div>
    );
}

export default Match;
