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
  setNickname: (name: string) => void;
  setRoom: (room: any) => void;
}

function MainApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [room, setRoom] = useState<any | null>(null);

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

  const stateContext: AppState = {
    socket,
    nickname,
    room,
    setNickname: (name: string) => {
      setNickname(name);
      localStorage.setItem('elevator_nickname', name);
    },
    setRoom,
  };

  return (
    <div className="app-wrapper">
      <Routes>
        <Route path="/" element={<Home appState={stateContext} />} />
        <Route path="/match" element={<Match appState={stateContext} />} />
        <Route path="/paint" element={<Paint appState={stateContext} />} />
        <Route path="/game" element={<Game appState={stateContext} />} />
        <Route path="/result" element={<Result appState={stateContext} />} />
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
