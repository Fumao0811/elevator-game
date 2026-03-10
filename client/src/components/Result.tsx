import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

function Result({ appState }: Props) {
    const navigate = useNavigate();
    const { socket, room, nickname } = appState;
    const [showResult, setShowResult] = useState(false);

    // 次ラウンドへの準備周りのステート
    const [timeLeft, setTimeLeft] = useState(5);
    const [isWaitingNext, setIsWaitingNext] = useState(false);

    useEffect(() => {
        if (!room) {
            navigate('/');
            return;
        }

        // 捕まった場合はジャンプスケアの絵（ドンッ！）を1秒間だけ表示して詳細結果へ
        // 逃げ切った場合はジャンプスケアなしで即座に詳細結果へ
        if (room.lastRoundCaught) {
            const timer = setTimeout(() => {
                setShowResult(true);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setShowResult(true);
        }
    }, [room, navigate]);

    // 結果表示後の5秒カウントダウン
    const isFinished = room?.status === 'FINISHED';
    useEffect(() => {
        if (!showResult || isFinished) return;
        if (timeLeft <= 0) return;

        const timerId = setTimeout(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timerId);
    }, [showResult, timeLeft, isFinished]);

    // 次ラウンド同期進行用ソケットイベント
    useEffect(() => {
        if (!socket) return;

        socket.on('waiting_for_opponent_next_round', () => {
            setIsWaitingNext(true);
        });

        socket.on('start_next_round', (updatedRoom) => {
            appState.setRoom(updatedRoom);
            navigate('/game');
        });

        return () => {
            socket.off('waiting_for_opponent_next_round');
            socket.off('start_next_round');
        };
    }, [socket, appState, navigate]);

    if (!room) return null;

    const myPlayerInfo = room.players.find((p: any) => p.nickname === nickname);
    const otherPlayerInfo = room.players.find((p: any) => p.nickname !== nickname);

    // サーバーが計算した前ラウンドの捕獲結果をそのまま利用する
    const isCaught = room.lastRoundCaught;

    // 自分視点でのテキスト
    // 前のラウンドでの自分の役割を判定 (直後にroleが入れ替わっているため逆転させる)
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
        // 自分が待ち伏せ側だった場合
        if (isCaught) {
            resultText = "捕獲成功！！";
            resultSubText = `${otherPlayerInfo.nickname} を捕まえました！`;
        } else {
            resultText = "逃走された…！";
            resultSubText = `${room.lastEscapedFloor}階へ逃げられました。`;
        }
        answerText = `あなた(待伏): ${room.lastWaitedFloor}F 🆚 ${otherPlayerInfo.nickname}(逃走): ${room.lastEscapedFloor}F`;
    }

    // 試合終了判定
    let finalResultText = '';
    if (isFinished) {
        if (room.winner === myPlayerInfo.id) finalResultText = '🏆 WINNER 🏆';
        else if (room.winner === 'DRAW') finalResultText = '🤝 DRAW 🤝';
        else finalResultText = '💀 LOSER 💀';
    }

    const handleNext = () => {
        if (isFinished) {
            appState.setRoom(null);
            navigate('/');
        } else {
            if (timeLeft > 0 || isWaitingNext) return;
            socket?.emit('ready_next_round', { roomId: room.roomId });
            setIsWaitingNext(true);
        }
    };

    const handleShare = () => {
        const url = encodeURIComponent(window.location.origin);
        let text = "";

        if (isFinished) {
            text = `「エレベーター心理戦」をプレイしました！最終スコア: ${myPlayerInfo.score}pt\n${finalResultText}\n`;
        } else {
            text = `「エレベーター心理戦」をプレイ中！\n【今回の結果】${resultText}\n${resultSubText}\n`;
        }
        text = encodeURIComponent(text);

        // X(旧Twitter)のシェアURL構築
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    };

    return (
        <div className="screen-container" style={{
            backgroundColor: showResult ? '#1a1a1a' : '#fff',
            transition: 'background-color 0.1s'
        }}>
            {!showResult ? (
                isCaught && (
                    // ドンッ！というジャンプスケア演出（相手の描いた絵）
                    <div style={{
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        zIndex: 9999,
                        animation: 'shake 0.1s cubic-bezier(.36,.07,.19,.97) both infinite, flashBg 0.5s infinite'
                    }}>
                        {otherPlayerInfo.drawnImage && (
                            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {/* 下層: AI生成の首なし体 */}
                                <img
                                    src="/body.png"
                                    alt="scary body"
                                    style={{ position: 'absolute', bottom: '-20%', width: '180%', height: '160%', objectFit: 'contain', zIndex: 9998, filter: 'drop-shadow(0 0 40px red)', opacity: 1, display: 'block' }}
                                />
                                {/* 上層: 手描きの顔 */}
                                <img
                                    src={otherPlayerInfo.drawnImage}
                                    alt="Scare Face"
                                    style={{
                                        position: 'absolute',
                                        top: '10%',
                                        width: '100%',
                                        zIndex: 9999,
                                        mixBlendMode: 'multiply',
                                        filter: 'drop-shadow(0 0 30px red) contrast(200%)',
                                        animation: 'fx-flicker 0.1s infinite'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )
            ) : (
                <div className="result-content" style={{ animation: 'fadeIn 0.5s ease' }}>

                    <div style={{ marginBottom: '40px' }}>
                        <h1 style={{
                            fontSize: '3rem',
                            color: isCaught ? '#ff2a3a' : '#4aff4a',
                            textShadow: '0 0 20px rgba(0,0,0,0.8)'
                        }}>
                            {resultText}
                        </h1>
                        <p style={{ marginTop: '10px', fontSize: '1.2rem', color: '#ccc' }}>
                            {resultSubText}
                        </p>
                        <div style={{
                            marginTop: '20px',
                            padding: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            display: 'inline-block',
                            color: '#e0e0e0',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <span style={{ fontSize: '0.9rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>【答え合わせ】</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{answerText}</span>
                        </div>
                    </div>

                    <div style={{
                        backgroundColor: '#222',
                        padding: '20px',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '300px',
                        margin: '0 auto',
                        border: '1px solid #444'
                    }}>
                        <h3 style={{ color: '#888', marginBottom: '16px' }}>現在のスコア</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem' }}>
                            <span style={{ color: '#fff' }}>あなた</span>
                            <span style={{ color: '#ff2a3a', fontWeight: 'bold' }}>{myPlayerInfo.score} pt</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginTop: '8px' }}>
                            <span style={{ color: '#aaa' }}>{otherPlayerInfo.nickname}</span>
                            <span style={{ color: '#aaa' }}>{otherPlayerInfo.score} pt</span>
                        </div>
                    </div>

                    {isFinished && (
                        <div style={{ marginTop: '40px', animation: 'pulse 2s infinite' }}>
                            <h2 style={{ fontSize: '2.5rem', color: '#ffd700' }}>{finalResultText}</h2>
                        </div>
                    )}

                    <div style={{
                        marginTop: '50px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '15px'
                    }}>
                        <button
                            className="btn"
                            onClick={handleNext}
                            style={{
                                width: '250px',
                                opacity: (!isFinished && timeLeft > 0) ? 0.5 : 1,
                                cursor: (!isFinished && timeLeft > 0) ? 'not-allowed' : 'pointer'
                            }}
                            disabled={(!isFinished && timeLeft > 0) || isWaitingNext}
                        >
                            {isFinished ? 'タイトルへ戻る' : (
                                isWaitingNext ? '相手を待っています...' :
                                    (timeLeft > 0 ? `次へ進むまで... ${timeLeft}秒` : '次のラウンドへ')
                            )}
                        </button>

                        {isFinished && (
                            <button
                                className="btn"
                                onClick={handleShare}
                                style={{
                                    width: '250px',
                                    backgroundColor: '#1DA1F2',
                                    borderColor: '#1DA1F2',
                                    color: '#fff'
                                }}
                            >
                                <span style={{ marginRight: '8px' }}>𝕏</span> 結果をポストする
                            </button>
                        )}
                    </div>
                </div>
            )}

            <style>
                {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes shake {
            10%, 90% { transform: translate3d(-5px, 0, 0); }
            20%, 80% { transform: translate3d(5px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-10px, -10px, 0); }
            40%, 60% { transform: translate3d(10px, 10px, 0); }
          }
          @keyframes flashBg {
            0% { background-color: #000; }
            50% { background-color: #300; }
            100% { background-color: #000; }
          }
        `}
            </style>
        </div>
    );
}

export default Result;
