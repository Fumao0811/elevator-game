import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';
interface Props { appState: AppState; }
function Game({ appState }: Props) {
    const navigate = useNavigate();
    const { socket, room, nickname } = appState;
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [isWaiting, setIsWaiting] = useState(false);
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdownNum, setCountdownNum] = useState(3);
    const [doorsOpening, setDoorsOpening] = useState(false);
    const [pendingResultRoom, setPendingResultRoom] = useState<any>(null);
    const [showRoundSplash, setShowRoundSplash] = useState(true);
    const [selectTimeLeft, setSelectTimeLeft] = useState(30);
    useEffect(() => {
        if (room?.round) {
            setShowRoundSplash(true);
            const timer = setTimeout(() => { setShowRoundSplash(false); }, 2000);
            return () => clearTimeout(timer);
        }
    }, [room?.round]);
    useEffect(() => {
        if (!socket || !room) { navigate('/'); return; }
        socket.on('both_ready_countdown', () => {
            setIsWaiting(false); setShowCountdown(true);
            let count = 3;
            const timer = setInterval(() => { count--; setCountdownNum(count); if (count <= 0) clearInterval(timer); }, 1000);
        });
        socket.on('round_result', (updatedRoom) => { setPendingResultRoom(updatedRoom); });
        socket.on('waiting_for_opponent', () => { setIsWaiting(true); });
        return () => { socket.off('both_ready_countdown'); socket.off('round_result'); socket.off('waiting_for_opponent'); };
    }, [socket, room, navigate, appState]);
    if (!room) return null;
    const myPlayerInfo = room.players.find((p: any) => p.nickname === nickname);
    const otherPlayerInfo = room.players.find((p: any) => p.nickname !== nickname);
    const isEscape = myPlayerInfo?.role === 'ESCAPE';
    const forbiddenFloor = isEscape ? myPlayerInfo?.lastEscapedFloor : otherPlayerInfo?.lastEscapedFloor;
    const floors = [1, 2, 3, 4, 5];
    const handleFloorSelect = (floor: number) => {
        if (isWaiting || showCountdown || floor === forbiddenFloor) return;

        // ★ここでも念のためボタンクリック時にサウンド再生権限をブロック解除させておく
        const dummyAudio = new Audio('/scare_sound.mp3');
        dummyAudio.volume = 0;
        dummyAudio.play().then(() => { dummyAudio.pause(); dummyAudio.currentTime = 0; }).catch(e => console.log('Audio Blocked:', e));
        setSelectedFloor(floor);
        socket?.emit('select_floor', { roomId: room.roomId, floor });
        setIsWaiting(true);
    };
    useEffect(() => {
        if (isWaiting || showCountdown || pendingResultRoom) return;
        if (selectTimeLeft <= 0) {
            const availableFloors = floors.filter(f => f !== forbiddenFloor);
            const fallbackFloor = availableFloors.length > 0 ? availableFloors[Math.floor(Math.random() * availableFloors.length)] : 1;
            handleFloorSelect(fallbackFloor); return;
        }
        const timerId = setTimeout(() => { setSelectTimeLeft(prev => prev - 1); }, 1000);
        return () => clearTimeout(timerId);
    }, [selectTimeLeft, isWaiting, showCountdown, pendingResultRoom, forbiddenFloor]);
    useEffect(() => {
        if (showCountdown && countdownNum === 0 && !doorsOpening && pendingResultRoom) {
            setDoorsOpening(true);
            setTimeout(() => { appState.setRoom(pendingResultRoom); navigate('/result'); }, 3500);
        }
    }, [showCountdown, countdownNum, doorsOpening, pendingResultRoom, navigate, appState]);
    if (showCountdown) {
        const isCaughtResult = pendingResultRoom?.lastRoundCaught;
        return (
            <div className="screen-container" style={{ padding: 0, position: 'relative' }}>
                <div className={`door-container ${doorsOpening ? 'doors-opening' : ''} ${!isEscape ? 'walk-towards' : ''}`}>
                    {countdownNum <= 0 && pendingResultRoom && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `radial-gradient(circle at center, rgba(220,220,220,0.3) 0%, rgba(0,0,0,0) 55%), url(/door_empty.png)`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: (!isEscape && isCaughtResult) ? 'dashInside 3.4s cubic-bezier(0.5, 0, 0.9, 0.2) forwards' : 'none' }}>
                            {isEscape && isCaughtResult && otherPlayerInfo?.drawnImage && (
                                <div className="creep-forward-inside" style={{ position: 'relative', width: '300px', height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' }}>
                                    <img src="/body.png" alt="scary body" style={{ position: 'absolute', bottom: '-40px', width: '200%', height: '200%', objectFit: 'contain', zIndex: 9998, filter: 'drop-shadow(0 0 10px red)', opacity: 1, display: 'block' }} />
                                    <img src={otherPlayerInfo.drawnImage} alt="scare face" style={{ position: 'absolute', top: '-60px', width: '85%', zIndex: 9999, mixBlendMode: 'normal', filter: 'drop-shadow(0 0 15px red) contrast(1.2)', animation: 'fx-flicker 0.2s infinite' }} onLoad={() => { const audio = new Audio('/scare_sound.mp3'); audio.volume = 1.0; audio.play().catch(e => console.log('Audio error:', e)); }} />
                                </div>
                            )}
                            {!isEscape && isCaughtResult && otherPlayerInfo?.drawnImage && (
                                <div style={{ position: 'relative', width: '200px', height: '260px', animation: 'fx-flicker 0.5s infinite', overflow: 'visible' }}>
                                    <img src="/body.png" alt="scary body target" style={{ position: 'absolute', bottom: '-20px', width: '200%', height: '200%', objectFit: 'contain', zIndex: 9998, opacity: 1, display: 'block' }} />
                                    <img src={otherPlayerInfo.drawnImage} alt="target face" style={{ position: 'absolute', top: '-40px', left: '10%', width: '85%', zIndex: 9999, mixBlendMode: 'normal', filter: 'drop-shadow(0 0 10px rgba(255,0,0,0.5))' }} onLoad={() => { const audio = new Audio('/scare_sound.mp3'); audio.volume = 1.0; audio.play().catch(e => console.log('Audio error:', e)); }} />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="door-panel door-left"></div>
                    <div className="door-panel door-right"></div>
                    <div style={{ position: 'absolute', top: '10%', left: '0', right: '0', textAlign: 'center', zIndex: 300, animation: 'fadeIn 0.5s ease forwards' }}><h2 style={{ display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.85)', padding: '10px 30px', borderRadius: '50px', color: isEscape ? '#4aff4a' : '#ff4a5a', border: `2px solid ${isEscape ? '#4aff4a' : '#ff4a5a'}`, boxShadow: `0 0 20px ${isEscape ? 'rgba(74,255,74,0.5)' : 'rgba(255,74,90,0.5)'}`, fontSize: '1.5rem', fontWeight: 'bold' }}>あなたは 【{isEscape ? 'エレベーターの中' : 'エレベーターの外'}】</h2></div>
                    <h1 className="fx-flicker" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '5rem', color: '#ff2a3a', zIndex: 200, pointerEvents: 'none', textShadow: '0 0 10px #000, 0 0 20px #ff0000', opacity: doorsOpening ? 0 : 1, transition: 'opacity 0.2s' }}>{countdownNum > 0 ? countdownNum : 'OPEN!'}</h1>
                </div>
            </div>
        );
    }
    const bgImage = isEscape ? '/bg_inside.png' : '/bg_outside.png';
    return (
        <div className="screen-container game-bg-anim" style={{ justifyContent: 'flex-start', paddingTop: '40px', backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
            {showRoundSplash && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeOutSplash 2s forwards' }}>
                    <h1 style={{ fontSize: '3.5rem', color: '#fff', textShadow: '0 0 20px #ff2a3a', letterSpacing: '5px', animation: 'scaleUpSplash 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>Round {room.round}</h1>
                    <h2 style={{ fontSize: '2rem', color: '#ff4a5a', marginTop: '10px', animation: 'scaleUpSplash 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>- {room.turn === 1 ? '表' : '裏'} -</h2>
                </div>
            )}
            <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '8px', border: '1px solid #444', marginBottom: '10px' }}>
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.9rem', marginBottom: '5px' }}>Round {room.round} ({room.turn === 1 ? '表' : '裏'}) / {room.maxRounds}</div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}><div style={{ color: '#fff', fontSize: '0.9rem' }}>あなたのポイント: <span style={{ color: '#ff2a3a', fontWeight: 'bold', fontSize: '1.2rem' }}>{myPlayerInfo?.score}</span></div><div style={{ color: '#aaa', fontSize: '0.9rem' }}>相手のポイント: <span style={{ fontSize: '1.2rem' }}>{otherPlayerInfo?.score}</span></div></div>
            </div>
            {!isWaiting && !showCountdown && !pendingResultRoom && (<div style={{ textAlign: 'center', marginTop: '10px' }}><h2 style={{ color: selectTimeLeft <= 5 ? '#ff4a5a' : '#fff', fontSize: '1.5rem', margin: 0 }}>残り時間: {selectTimeLeft}秒</h2></div>)}
            <div style={{ margin: '20px 0' }}>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>あなたは</p><h2 className="highlight-role">{isEscape ? '逃げる側 (中)' : '待ち伏せ側 (外)'}</h2>
                <p style={{ color: '#888', marginTop: '8px', fontSize: '0.85rem' }}>{isEscape ? 'エレベーターの行き先を選んでください。高層階ほど高得点ですが読まれやすいです。' : '相手が降りる階を予想し、待ち伏せする階を選んでください。'}</p>
            </div>
            <div className={`elevator-board ${isWaiting ? 'disabled' : ''}`}>
                {floors.map((floor) => {
                    const isForbidden = floor === forbiddenFloor;
                    return (<button key={floor} className={`floor-btn ${selectedFloor === floor ? 'selected' : ''} ${isForbidden ? 'forbidden' : ''}`} onClick={() => handleFloorSelect(floor)} disabled={isWaiting || isForbidden} style={{ opacity: isWaiting && selectedFloor !== floor ? 0.3 : 1, filter: isForbidden ? 'grayscale(100%)' : 'none' }}>{floor}F</button>);
                })}
            </div>
            {isWaiting && (<div style={{ padding: '10px', color: '#fff', animation: 'pulse 1.5s infinite' }}>相手の選択を待っています...</div>)}
            {room.history && room.history.length > 0 && (
                <div style={{ marginTop: 'auto', width: '100%', maxWidth: '400px', backgroundColor: 'rgba(0, 0, 0, 0.6)', border: '1px solid #333', borderRadius: '8px', padding: '10px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#aaa', marginBottom: '5px', textAlign: 'center', borderBottom: '1px solid #444', paddingBottom: '5px' }}>📋 これまでの履歴</h3>
                    {[...room.history].reverse().map((h: any, idx: number) => (<div key={idx} style={{ fontSize: '0.95rem', padding: '10px', backgroundColor: h.isCaught ? 'rgba(255, 0, 0, 0.15)' : 'rgba(0, 255, 0, 0.1)', borderLeft: `6px solid ${h.isCaught ? '#ff2a3a' : '#4aff4a'}`, display: 'flex', justifyContent: 'space-between', color: '#eee', fontWeight: 'bold' }}><span>R{h.round}({h.turn === 1 ? '表' : '裏'})</span><span>逃:{h.escapeNickname}({h.escapedFloor}F) 🆚 待:{h.waitNickname}({h.waitedFloor}F)</span><span>{h.isCaught ? '❌捕獲' : '⭕逃走'}</span></div>))}
                </div>
            )}
            <style>
                {`
          .disabled { pointer-events: none; }
          .floor-btn.forbidden { background: #222; color: #444; box-shadow: inset 0 0 10px #000; border: 1px solid #111; cursor: not-allowed; }
          .floor-btn.forbidden::after { border-color: transparent; }
          @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
          @keyframes fadeOutSplash { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
          @keyframes scaleUpSplash { 0% { transform: scale(0.5); opacity: 0; } 20% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        `}
            </style>
        </div>
    );
}
export default Game;
