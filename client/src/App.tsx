import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Home from './components/Home';
import Match from './components/Match';
import Paint from './components/Paint';
import Game from './components/Game';
import Result from './components/Result';
import './index.css';

// 開発環境の場合はローカルの3001ポート、本番環境(統合版)は同じURLを自動で向くように空文字にする
// Render/Railway等にデプロイされた場合、ReactアプリはNodeサーバーから配信されるため '/' で同じドメインのSocketを叩けます
const SERVER_URL = import.meta.env.DEV ? `http://${window.location.hostname}:3001` : '';

// Contextなどで共有する状態の型定義
export interface AppState {
  socket: Socket | null;
  nickname: string;
  room: any | null; // サーバーから来るRoom情報
  globalVolume: number; // 0.0 ~ 1.0 (BGM/SEのマスター音量)
  setNickname: (name: string) => void;
  setRoom: (room: any) => void;
  setGlobalVolume: (vol: number) => void;
}

function MainApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [room, setRoom] = useState<any | null>(null);
  const [globalVolume, setGlobalVolume] = useState<number>(0.2); // 初期音量を20%にする

  const navigate = useNavigate();

  useEffect(() => {
    // コンポーネントマウント時にSocket接続
    // localtunnelのWarning画面をバイパスするヘッダーを付与
    const newSocket = io(SERVER_URL || undefined, {
      extraHeaders: {
        "Bypass-Tunnel-Reminder": "true",
      }
    });
    setSocket(newSocket);

    // LocalStorageからニックネーム復元
    const savedName = localStorage.getItem('elevator_nickname');
    if (savedName) setNickname(savedName);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 画面クリック時の花エフェクト・タップ音追加
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // 花の要素を作成
      const flower = document.createElement('div');
      flower.className = 'click-flower';
      flower.innerText = '🌸'; // 使う絵文字

      // クリックした位置に配置
      flower.style.left = `${e.clientX}px`;
      flower.style.top = `${e.clientY}px`;

      // bodyに追加
      document.body.appendChild(flower);

      // タップ音を鳴らす
      const tapAudio = new Audio('/se_tap.mp3');
      tapAudio.volume = Math.max(0, Math.min(1, 0.5 * globalVolume)); // 0.5はベースの音量
      tapAudio.play().catch(err => console.log('Tap Audio prevented:', err));

      // アニメーションが終わる頃(0.8秒後)に要素を削除
      setTimeout(() => {
        if (flower.parentNode) {
          flower.parentNode.removeChild(flower);
        }
      }, 800);
    };

    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [globalVolume]); // globalVolumeが変わった時だけ再登録

  // Socketイベントのグローバルリッスン
  useEffect(() => {
    if (!socket) return;

    socket.on('match_found', (roomData) => {
      setRoom(roomData);
      // PLAYINGではなくDRAWINGステートから始まるためPaint画面に遷移
      navigate('/paint');
    });

    socket.on('opponent_disconnected', () => {
      alert('相手が切断しました。');
      setRoom(null);
      navigate('/');
    });

    return () => {
      socket.off('match_found');
      socket.off('opponent_disconnected');
    };
  }, [socket, navigate]);

  const appState: AppState = {
    socket,
    nickname,
    room,
    globalVolume,
    setNickname: (name: string) => { // Preserve localStorage logic
      setNickname(name);
      localStorage.setItem('elevator_nickname', name);
    },
    setRoom,
    setGlobalVolume
  };

  return (
    <div className="app-wrapper">
      {/* 全画面共通の音量調節UI */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '15px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '5px 10px',
        borderRadius: '20px',
        border: '1px solid #444'
      }}>
        <span style={{ color: '#fff', fontSize: '1.2rem' }}>
          {globalVolume === 0 ? '🔇' : (globalVolume < 0.5 ? '🔉' : '🔊')}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={globalVolume}
          onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
          style={{ width: '80px', cursor: 'pointer' }}
        />
      </div>

      <Routes>
        <Route path="/" element={<Home appState={appState} />} />
        <Route path="/match" element={<Match appState={appState} />} />
        <Route path="/paint" element={<Paint appState={appState} />} />
        <Route path="/game" element={<Game appState={appState} />} />
        <Route path="/result" element={<Result appState={appState} />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}

export default App;
