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
    const [splashStep, setSplashStep] = useState(0); // 0: off, 1: Round/Turn, 2: Role info
    const [selectTimeLeft, setSelectTimeLeft] = useState(30);
    useEffect(() => {
        if (room?.round) {
            setSplashStep(1);
            const timer1 = setTimeout(() => { setSplashStep(2); }, 2000);
            const timer2 = setTimeout(() => { setSplashStep(0); }, 4000);
            return () => { clearTimeout(timer1); clearTimeout(timer2); };
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
        if (isWaiting || showCountdown || floor === forbiddenFloor || splashStep === 1) return;

        // ★ここでも念のためボタンクリック時にサウンド再生権限をブロック解除させておく
        const dummyAudio = new Audio('/scare_sound_escape.mp3');
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
        if (showCountdown && countdownNum === 0 && pendingResultRoom && !doorsOpening) {
            console.log('Door Transition: Triggering transition sequence');
            setDoorsOpening(true);
            
            // 演出時間を設定。ジャンプスケアがある場合は長めに、ない場合は標準的に。
            const delay = pendingResultRoom.lastRoundCaught ? 4500 : 3000;
            
            const timer = setTimeout(() => { 
                console.log(`Door Transition: Navigating to result after ${delay}ms...`);
                appState.setRoom(pendingResultRoom); 
                navigate('/result'); 
            }, delay);
            
            return () => {
                console.log('Door Transition: Effect cleanup occurred');
                clearTimeout(timer);
            };
        }
    }, [showCountdown, countdownNum, pendingResultRoom, navigate, appState]); // doorsOpening を依存関係から外すことで、setDoorsOpening(true) による再実行とタイマー破棄を阻止
    const [processedFace, setProcessedFace] = useState<string | null>(null);

    // 【背景透過ユーティリティ】現在は透過をやめているためそのまま返す
    const processImage = (src: string): Promise<string> => {
        return Promise.resolve(src);
    };

    useEffect(() => {
        const isCaughtResult = pendingResultRoom?.lastRoundCaught;
        if (showCountdown && isCaughtResult && otherPlayerInfo?.drawnImage) {
            console.log('Scare Preparation: Processing face...');
            processImage(otherPlayerInfo.drawnImage).then(setProcessedFace);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCountdown, pendingResultRoom?.lastRoundCaught, otherPlayerInfo?.drawnImage]);

    if (showCountdown) {
        const isCaughtResult = pendingResultRoom?.lastRoundCaught;

        return (
            <div className="screen-container" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
                <div className={`door-container ${doorsOpening ? 'doors-opening' : ''}`}>
                    {/* カウントダウン文字は非表示 */}
                    
                    {/* 扉の奥（背景） */}
                    {countdownNum <= 0 && pendingResultRoom && (
                        <div style={{ 
                            position: 'absolute', 
                            top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.4) 70%), url(/${isEscape ? 'elevator_opened_inside.png' : 'elevator_opened_outside.png'})`, 
                            backgroundSize: 'cover', 
                            backgroundPosition: 'center', 
                            zIndex: 10, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            // 追いかける側ならカメラが壁に向かってじわじわ踏み込む
                            animation: (!isEscape) ? 'camera-step-in 4s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none'
                        }}>
                            {/* ジャンプスケアの顔 */}
                            {isCaughtResult && processedFace && (
                                <div style={{ 
                                    position: 'relative', 
                                    zIndex: 20,
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img 
                                        src={processedFace} 
                                        alt="scare face" 
                                        style={{ 
                                            width: isEscape ? '40%' : '50%', 
                                            maxWidth: '450px',
                                            filter: 'drop-shadow(0 0 30px red) contrast(1.4) brightness(0.8)', 
                                            // 逃げる側：外から入ってくる / 追いかける側：中で待ち構えている（自分が近づく）
                                            animation: isEscape ? 'ghost-creep-in 3.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'fx-flicker 0.2s infinite'
                                        }} 
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="door-panel door-left" style={{ backgroundImage: `url(/door_${isEscape ? 'inside_new' : 'outside_new'}.png)`, backgroundSize: '200% 100%', backgroundPosition: '0% center' }}></div>
                    <div className="door-panel door-right" style={{ backgroundImage: `url(/door_${isEscape ? 'inside_new' : 'outside_new'}.png)`, backgroundSize: '200% 100%', backgroundPosition: '100% center' }}></div>
                    
                    <div style={{ position: 'absolute', top: '10%', left: '0', right: '0', textAlign: 'center', zIndex: 1100, animation: 'fadeIn 0.5s ease forwards' }}><h2 style={{ display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.85)', padding: '10px 30px', borderRadius: '50px', color: isEscape ? '#4aff4a' : '#ff4a5a', border: `2px solid ${isEscape ? '#4aff4a' : '#ff4a5a'}`, boxShadow: `0 0 20px ${isEscape ? 'rgba(74,255,74,0.5)' : 'rgba(255,74,90,0.5)'}`, fontSize: '1.5rem', fontWeight: 'bold' }}>あなたは 【{isEscape ? 'エレベーターの中' : 'エレベーターの外'}】</h2></div>
                </div>

                <style>{`
                    @keyframes ghost-creep-in {
                        0% { transform: scale(0.1) translateY(50px); opacity: 0; filter: brightness(0); }
                        40% { transform: scale(0.5); opacity: 1; filter: brightness(0.5); }
                        100% { transform: scale(1.5); opacity: 1; filter: brightness(1.2); }
                    }
                    @keyframes camera-step-in {
                        0% { transform: scale(1); }
                        100% { transform: scale(1.8); }
                    }
                `}</style>
            </div>
        );
    }
    const bgImage = isEscape ? '/bg_inside.png' : '/bg_outside.png';
    return (
        <div className="screen-container game-bg-anim" style={{ justifyContent: 'flex-start', paddingTop: '40px', backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
            {splashStep === 1 && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeOutSplash 2s forwards' }}>
                    <h1 style={{ fontSize: '3.5rem', color: '#fff', textShadow: '0 0 20px #ff2a3a', letterSpacing: '5px', animation: 'scaleUpSplash 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>Round {room.round}</h1>
                    <h2 style={{ fontSize: '2rem', color: '#ff4a5a', marginTop: '10px', animation: 'scaleUpSplash 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>- {room.turn === 1 ? '表' : '裏'} -</h2>
                </div>
            )}
            {splashStep === 2 && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeOutSplash 2s forwards' }}>
                    <h1 style={{ fontSize: '2.5rem', color: isEscape ? '#4aff4a' : '#ff4a5a', textShadow: '0 0 15px rgba(0,0,0,0.8)', letterSpacing: '2px', animation: 'scaleUpSplash 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards', textAlign: 'center', padding: '0 20px', lineHeight: '1.4' }}>
                        {isEscape ? '相手から逃げてください。' : '相手を見つけてください。'}
                    </h1>
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
            <div className={`elevator-board ${(isWaiting || splashStep === 1) ? 'disabled' : ''}`}>
                {floors.map((floor) => {
                    const isForbidden = floor === forbiddenFloor;
                    return (<button key={floor} className={`floor-btn ${selectedFloor === floor ? 'selected' : ''} ${isForbidden ? 'forbidden' : ''}`} onClick={() => handleFloorSelect(floor)} disabled={isWaiting || isForbidden || splashStep === 1} style={{ opacity: isWaiting && selectedFloor !== floor ? 0.3 : 1, filter: isForbidden ? 'grayscale(100%)' : 'none' }}>{floor}F</button>);
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
