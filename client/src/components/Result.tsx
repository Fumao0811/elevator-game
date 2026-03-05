import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

function Result({ appState }: Props) {
    const navigate = useNavigate();
    const { room, nickname } = appState;
    const [showResult, setShowResult] = useState(false);

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

    if (!room) return null;

    const myPlayerInfo = room.players.find((p: any) => p.nickname === nickname);
    const otherPlayerInfo = room.players.find((p: any) => p.nickname !== nickname);

    // サーバーが計算した前ラウンドの捕獲結果をそのまま利用する
    const isCaught = room.lastRoundCaught;

    // 自分視点でのテキスト
    // ※本来は前のターンでの「自分が逃げ・待ちどちらだったか」に基づく判定がベスト
    const resultText = isCaught ? "捕獲された…！！" : "逃走成功！";
    const resultSubText = isCaught
        ? `${otherPlayerInfo.nickname} に見つかりました。`
        : `${myPlayerInfo.selectedFloor}階へ逃げ切りました。`;

    // 試合終了判定
    const isFinished = room.status === 'FINISHED';
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
            navigate('/game');
        }
    };

    const handleShare = () => {
        const url = encodeURIComponent(window.location.origin);
        let text = "";

        if (isFinished) {
            text = `「エレベーター心理戦」をプレイしました！最終スコア: ${myPlayerInfo.score}pt\n${finalResultText}\n`;
        } else {
            text = isCaught
                ? `「エレベーター心理戦」で ${otherPlayerInfo.nickname} に見つかり、恐ろしいおばけに遭遇しました…！\n`
                : `「エレベーター心理戦」で ${myPlayerInfo.selectedFloor}階へ逃げ切りました！\n`;
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
                            <img
                                src={otherPlayerInfo.drawnImage}
                                alt="Scare Face"
                                style={{
                                    width: '100%',
                                    maxWidth: '600px',
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 0 30px red) contrast(200%)',
                                    transform: 'scale(1.2)'
                                }}
                            />
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
                            style={{ width: '250px' }}
                        >
                            {isFinished ? 'タイトルへ戻る' : '次のラウンドへ'}
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
