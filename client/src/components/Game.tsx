import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

function Game({ appState }: Props) {
    const navigate = useNavigate();
    const { socket, room, nickname } = appState;

    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [isWaiting, setIsWaiting] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownNum, setCountdownNum] = useState(3);
    const [doorsOpening, setDoorsOpening] = useState(false);
    const [pendingResultRoom, setPendingResultRoom] = useState<any>(null);

    useEffect(() => {
        if (!socket || !room) {
            navigate('/');
            return;
        }

        // 両者準備完了時のイベント（3秒カウントダウン開始）
        socket.on('both_ready_countdown', () => {
            setIsWaiting(false);
            setShowCountdown(true);

            let count = 3;
            const timer = setInterval(() => {
                count--;
                setCountdownNum(count);
                if (count <= 0) {
                    clearInterval(timer);
                }
            }, 1000);
        });

        // サーバーから結果（REVEAL）が届く
        socket.on('round_result', (updatedRoom) => {
            // 即座に遷移せず、カウントダウンと扉アニメーションに制御を委譲する
            setPendingResultRoom(updatedRoom);
        });

        socket.on('waiting_for_opponent', () => {
            setIsWaiting(true);
        });

        return () => {
            socket.off('both_ready_countdown');
            socket.off('round_result');
            socket.off('waiting_for_opponent');
        };
    }, [socket, room, navigate, appState]);

    if (!room) return null;

    // 自分の役割を取得
    const myPlayerInfo = room.players.find((p: any) => p.nickname === nickname);
    const otherPlayerInfo = room.players.find((p: any) => p.nickname !== nickname);
    const isEscape = myPlayerInfo?.role === 'ESCAPE';

    const floors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const handleFloorSelect = (floor: number) => {
        if (isWaiting || showCountdown) return;

        setSelectedFloor(floor);
        socket?.emit('select_floor', { roomId: room.roomId, floor });
        setIsWaiting(true);
    };

    // カウントダウンと扉アニメーションの制御
    useEffect(() => {
        if (showCountdown && countdownNum === 0 && !doorsOpening && pendingResultRoom) {
            // OPEN! となったタイミングで扉を開くフラグを立てる
            setDoorsOpening(true);

            // 扉が徐々に開ききってから（約3秒後）、Result画面へ結果を同期・遷移させる
            setTimeout(() => {
                appState.setRoom(pendingResultRoom);
                navigate('/result');
            }, 3500); // アニメーション3.0秒 + 余韻0.5秒
        }
    }, [showCountdown, countdownNum, doorsOpening, pendingResultRoom, navigate, appState]);

    if (showCountdown) {
        // カウントダウン中および扉開閉演出画面
        const isCaughtResult = pendingResultRoom?.lastRoundCaught;

        return (
            <div className="screen-container" style={{ padding: 0, position: 'relative' }}>
                {/* エレベーター全体・左右の扉パネル */}
                <div className={`door-container ${doorsOpening ? 'doors-opening' : ''} ${!isEscape ? 'walk-towards' : ''}`}>

                    {/* 扉の奥（判定結果の景色） */}
                    {countdownNum <= 0 && pendingResultRoom && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: `url(/door_empty.png)`, // 基本は誰もいない暗い部屋
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {/* 捕まっていた場合、相手の描いた絵が徐々に迫ってくる */}
                            {isCaughtResult && otherPlayerInfo?.drawnImage && (
                                <img
                                    src={otherPlayerInfo.drawnImage}
                                    className="creep-forward"
                                    alt="scare"
                                    style={{
                                        maxWidth: '300px',
                                        width: '80%',
                                        filter: 'drop-shadow(0 0 20px red)'
                                    }}
                                />
                            )}
                        </div>
                    )}

                    <div className="door-panel door-left"></div>
                    <div className="door-panel door-right"></div>

                    {/* カウントダウン表示（扉の上） */}
                    <h1
                        className="fx-flicker"
                        style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            fontSize: '5rem', color: '#ff2a3a', zIndex: 200, pointerEvents: 'none',
                            textShadow: '0 0 10px #000, 0 0 20px #ff0000',
                            opacity: doorsOpening ? 0 : 1, // 開き始めたら消す
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {countdownNum > 0 ? countdownNum : 'OPEN!'}
                    </h1>
                </div>
            </div>
        );
    }

    // 背景画像の設定
    const bgImage = isEscape ? '/bg_inside.png' : '/bg_outside.png';

    return (
        <div
            className="screen-container game-bg-anim"
            style={{
                justifyContent: 'flex-start',
                paddingTop: '40px',
                backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative'
            }}
        >

            {/* ヘッダー情報 */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', color: '#888' }}>
                <span>Round {room.round} / {room.maxRounds}</span>
                <span>My Score: {myPlayerInfo?.score}</span>
            </div>

            {/* 役割表示 */}
            <div style={{ margin: '20px 0' }}>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>あなたは</p>
                <h2 className="highlight-role">
                    {isEscape ? '逃げる側 (中)' : '待ち伏せ側 (外)'}
                </h2>
                <p style={{ color: '#888', marginTop: '8px', fontSize: '0.85rem' }}>
                    {isEscape
                        ? 'エレベーターの行き先を選んでください。高層階ほど高得点ですが読まれやすいです。'
                        : '相手が降りる階を予想し、待ち伏せする階を選んでください。'}
                </p>
            </div>

            {/* 階層選択（エレベーターボタン） */}
            <div className={`elevator-board ${isWaiting ? 'disabled' : ''}`}>
                {floors.map((floor) => (
                    <button
                        key={floor}
                        className={`floor-btn ${selectedFloor === floor ? 'selected' : ''}`}
                        onClick={() => handleFloorSelect(floor)}
                        disabled={isWaiting}
                        style={{ opacity: isWaiting && selectedFloor !== floor ? 0.3 : 1 }}
                    >
                        {floor}F
                    </button>
                ))}
            </div>

            {/* 待機表示 */}
            {isWaiting && (
                <div style={{ marginTop: 'auto', padding: '20px', color: '#fff', animation: 'pulse 1.5s infinite' }}>
                    相手の選択を待っています...
                </div>
            )}

            <style>
                {`
          .disabled { pointer-events: none; }
          @keyframes pulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
        `}
            </style>
        </div>
    );
}

export default Game;
