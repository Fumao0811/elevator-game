import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';
interface Props { appState: AppState; }
function Result({ appState }: Props) {
    const navigate = useNavigate();
    const { socket, room, nickname } = appState;
    const [showScare, setShowScare] = useState(false);
    const [isWaitingNext, setIsWaitingNext] = useState(false);
    const scareAudioRef = useRef<HTMLAudioElement | null>(null);
    const [timeLeft, setTimeLeft] = useState(5);
    const myPlayerInfo = room?.players.find((p: any) => p.nickname === nickname);
    const otherPlayerInfo = room?.players.find((p: any) => p.nickname !== nickname);
    const isCaught = room?.lastRoundCaught;
    const isFinished = room?.status === 'FINISHED';
    useEffect(() => {
        if (!socket || !room) { navigate('/'); return; }
        if (isCaught) {
            setShowScare(true);
            if (!scareAudioRef.current) {
                scareAudioRef.current = new Audio('/scare_sound.mp3');
                scareAudioRef.current.volume = 1.0;
            }
            scareAudioRef.current.play().catch(e => console.log('Audio autoplay prevented:', e));
            // ジャンプスケア画面の表示時間
            setTimeout(() => {
                setShowScare(false);
            }, 2500); 
        }
        socket.on('waiting_for_opponent_next_round', () => { setIsWaitingNext(true); });
        socket.on('start_next_round', (updatedRoom) => { appState.setRoom(updatedRoom); navigate('/game'); });
        socket.on('game_finished', (updatedRoom: any) => { appState.setRoom(updatedRoom); alert('ゲーム終了！最終結果を確認します。'); navigate('/'); });
        return () => {
            socket.off('waiting_for_opponent_next_round');
            socket.off('start_next_round');
            socket.off('game_finished');
        };
    }, [socket, room, isCaught, navigate, appState]);
    useEffect(() => {
        if (showScare || isFinished) return;
        if (timeLeft <= 0) return;
        const timerId = setTimeout(() => { setTimeLeft(prev => prev - 1); }, 1000);
        return () => clearTimeout(timerId);
    }, [showScare, timeLeft, isFinished]);
    const [processedFace, setProcessedFace] = useState<string | null>(null);

    // 【背景透過ユーティリティ】
    const processImage = (src: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(src); return; }
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    if (r > 240 && g > 240 && b > 240) {
                        data[i + 3] = 0;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL());
            };
            img.onerror = () => resolve(src);
        });
    };

    useEffect(() => {
        if (showScare && otherPlayerInfo?.drawnImage) {
            processImage(otherPlayerInfo.drawnImage).then(setProcessedFace);
        }
    }, [showScare, otherPlayerInfo?.drawnImage]);

    if (!room || !myPlayerInfo) return null;

    const handleNextRound = () => {
        if (!socket) return;
        if (timeLeft > 0 || isWaitingNext) return;
        socket.emit('ready_next_round', { roomId: room.roomId });
        setIsWaitingNext(true);
    };
    const handleBackToTitle = () => { appState.setRoom(null); navigate('/'); };
    const wasEscape = myPlayerInfo.role === 'WAIT';

    let resultText = "";
    let resultSubText = "";
    let answerText = "";
    if (wasEscape) {
        if (isCaught) {
            resultText = "捕獲された…！！";
            resultSubText = `${otherPlayerInfo.nickname} に見つかりました。`;
        } else {
            resultText = "逃走成功！";
            resultSubText = `${room.lastEscapedFloor}階へ逃げ切りました！獲得ポイント：${room.lastEscapedFloor}`;
        }
        answerText = `あなた(逃走): ${room.lastEscapedFloor}F 🆚 ${otherPlayerInfo.nickname}(待伏): ${room.lastWaitedFloor}F`;
    } else {
        if (isCaught) {
            resultText = "捕獲成功！！";
            resultSubText = `${otherPlayerInfo.nickname} を捕まえました！`;
        } else {
            resultText = "逃走された…！";
            resultSubText = `${room.lastEscapedFloor}階へ逃げられました。`;
        }
        answerText = `あなた(待伏): ${room.lastWaitedFloor}F 🆚 ${otherPlayerInfo.nickname}(逃走): ${room.lastEscapedFloor}F`;
    }
    let finalResultText = '';
    if (isFinished) {
        if (room.winner === myPlayerInfo.id) finalResultText = '🏆 WINNER 🏆';
        else if (room.winner === 'DRAW') finalResultText = '🤝 DRAW 🤝';
        else finalResultText = '💀 LOSER 💀';
    }
    const generateShareText = () => {
        const title = "🚪 エレベーター心理戦ゲーム\n";
        const result = isFinished ? `最終スコア: ${myPlayerInfo.score}pt (${finalResultText})\n` : `【今回の結果】${resultText} ${resultSubText}\n`;
        const url = window.location.origin;
        return encodeURIComponent(title + result + "\n#エレベーター心理戦 #ブラウザゲーム\n" + url);
    };
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${generateShareText()}`;

    return (
        <div className="screen-container">
            {showScare ? (
                <div style={{ backgroundColor: '#000', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, zIndex: 9999, animation: 'shake 0.1s cubic-bezier(.36,.07,.19,.97) both infinite, flashBg 0.5s infinite', backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.5) 80%), url(/${wasEscape ? 'elevator_opened_inside.png' : 'elevator_opened_outside.png'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    {processedFace ? (
                        <div style={{ 
                            position: 'relative', 
                            width: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            animation: 'fx-flicker 0.1s infinite'
                        }}>
                            <img 
                                src={processedFace} 
                                alt="Scare Face" 
                                style={{ 
                                    width: wasEscape ? '70%' : '85%', 
                                    maxWidth: '600px',
                                    zIndex: 9999, 
                                    filter: 'drop-shadow(0 0 40px red) contrast(170%)', 
                                    transform: wasEscape ? 'scale(1.0)' : 'scale(1.2)'
                                }} 
                            />
                        </div>
                    ) : (
                        <div style={{ color: '#ff2a3a', fontSize: '2rem', animation: 'pulse 1s infinite' }}>Loading Scare...</div>
                    )}
                </div>
            ) : (
                <div className="result-content" style={{ animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ marginBottom: '40px' }}>
                        <h1 style={{ fontSize: '3rem', color: (wasEscape ? !isCaught : isCaught) ? '#4aff4a' : '#ff2a3a', textShadow: '0 0 20px rgba(0,0,0,0.8)' }}>{resultText}</h1>
                        <p style={{ marginTop: '10px', fontSize: '1.2rem', color: '#ccc' }}>{resultSubText}</p>
                        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', display: 'inline-block', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.2)' }}><span style={{ fontSize: '0.9rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>【答え合わせ】</span><span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{answerText}</span></div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: '10px', border: '1px solid #444', marginBottom: '30px', width: '100%', maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem' }}><span style={{ color: '#aaa' }}>あなた ({myPlayerInfo.nickname})</span><span style={{ color: '#fff', fontWeight: 'bold' }}>{myPlayerInfo.score} pt</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginTop: '8px' }}><span style={{ color: '#666' }}>相手 ({otherPlayerInfo?.nickname})</span><span style={{ color: '#888' }}>{otherPlayerInfo?.score} pt</span></div>
                    </div>
                    {isFinished && (
                        <>
                            <div style={{ marginTop: '40px', animation: 'pulse 2s infinite' }}><h2 style={{ fontSize: '2.5rem', color: '#ffd700' }}>{finalResultText}</h2></div>
                            <div style={{ marginBottom: '30px' }}><a href={twitterShareUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#1DA1F2', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 10px rgba(29, 161, 242, 0.4)', transition: 'transform 0.2s' }}><span style={{ marginRight: '8px' }}>𝕏</span> X (Twitter) で結果をポストする</a></div>
                        </>
                    )}
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                        <button className={`btn ${isWaitingNext || (!isFinished && timeLeft > 0) ? 'disabled' : ''}`} onClick={isFinished ? handleBackToTitle : handleNextRound} disabled={isWaitingNext || (!isFinished && timeLeft > 0)} style={{ width: '250px', opacity: (!isFinished && timeLeft > 0) ? 0.5 : 1, cursor: (!isFinished && timeLeft > 0) ? 'not-allowed' : 'pointer' }}>{isFinished ? 'タイトルへ戻る' : (isWaitingNext ? '相手を待っています...' : (timeLeft > 0 ? `次へ進むまで... ${timeLeft}秒` : '次のラウンドへ'))}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
export default Result;
