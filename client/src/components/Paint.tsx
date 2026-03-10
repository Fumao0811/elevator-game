import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props {
    appState: AppState;
}

const Paint: React.FC<Props> = ({ appState }) => {
    const { socket, room, setRoom } = appState;
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false); // 何か描いたか
    const [isSubmitted, setIsSubmitted] = useState(false);

    // 追加機能: ペンの色と消しゴムモード
    const [currentColor, setCurrentColor] = useState('#000000');
    const [isEraser, setIsEraser] = useState(false);

    // 30秒のタイマー
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (!socket || !room) {
            navigate('/');
            return;
        }

        // 両者がお絵かきを完了したらゲーム画面へ
        const handleDrawingFinished = (updatedRoom: any) => {
            setRoom(updatedRoom);
            navigate('/game');
        };

        socket.on('drawing_finished', handleDrawingFinished);

        return () => {
            socket.off('drawing_finished', handleDrawingFinished);
        };
    }, [socket, room, navigate, setRoom]);

    // タイマー処理
    useEffect(() => {
        if (isSubmitted) return;

        if (timeLeft <= 0) {
            submitDrawing();
            return;
        }

        const timerId = setTimeout(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timerId);
    }, [timeLeft, isSubmitted]);


    // スマホ対応の描画座標取得
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const rect = canvas.getBoundingClientRect();
        // CSSと実際の解像度のスケーリング対応
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (isSubmitted) return;
        setIsDrawing(true);
        setHasDrawn(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            // 消しゴム(背景透過)か通常の色書きかによってペン先設定を変える
            if (isEraser) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = 20; // 消しゴムは太めにする
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = currentColor;
                ctx.lineWidth = 8;
            }
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || isSubmitted) return;
        e.preventDefault(); // スクロール防止
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const endDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.closePath();
        }
    };

    const clearCanvas = () => {
        if (isSubmitted) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    const submitDrawing = () => {
        if (isSubmitted || !socket || !room) return;
        setIsSubmitted(true);

        const canvas = canvasRef.current;
        if (canvas) {
            // 背景を白にした状態でエクスポートするため、別Canvasに結合する
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) {
                // 背景を透明のままにするため、塗りつぶし処理を削除
                tCtx.drawImage(canvas, 0, 0);
            }

            const dataUrl = tempCanvas.toDataURL('image/png');
            socket.emit('submit_drawing', {
                roomId: room.roomId,
                imageBase64: dataUrl
            });
        }
    };

    // Canvasの初期設定
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            // 内部解像度を少し高めに設定
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // 背景を透明にしておく
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                // 初期設定
                ctx.strokeStyle = currentColor;
                ctx.lineWidth = 10;
            }
        }
    }, []);

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff' }}>おばけを描け！</h2>
            <p style={{ color: '#aaa', margin: '5px 0' }}>扉が開いた時に相手を驚かす絵です</p>

            {!isSubmitted && (
                <h3 style={{ color: timeLeft <= 5 ? '#ff4444' : '#fff' }}>残り時間: {timeLeft}秒</h3>
            )}

            {/* ツールパレット（カラー・消しゴム選択） */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                <span style={{ color: '#aaa', fontSize: '0.9rem', marginRight: '5px' }}>ツール:</span>
                {[
                    { color: '#000000', label: '黒' },
                    { color: '#ffcc99', label: '肌' },
                    { color: '#ff4a5a', label: '赤' },
                    { color: '#4aff4a', label: '緑' },
                    { color: '#4a9aff', label: '青' },
                    { color: '#ffff4a', label: '黄' }
                ].map((pen) => (
                    <button
                        key={pen.color}
                        onClick={() => { setIsEraser(false); setCurrentColor(pen.color); }}
                        style={{
                            width: '30px', height: '30px',
                            backgroundColor: pen.color,
                            borderRadius: '50%', border: 'none', cursor: 'pointer',
                            boxShadow: (!isEraser && currentColor === pen.color) ? '0 0 0 3px #fff' : 'none',
                            transition: 'all 0.2s'
                        }}
                        title={pen.label}
                    />
                ))}

                {/* 消しゴムボタン */}
                <button
                    onClick={() => setIsEraser(true)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#333',
                        color: '#fff',
                        border: isEraser ? '2px solid #fff' : '2px solid #555',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        marginLeft: '10px'
                    }}
                >
                    消しゴム
                </button>

                {/* 全部消去ボタン */}
                <button
                    onClick={clearCanvas}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#8b0000',
                        color: '#fff',
                        border: '2px solid #ff4a5a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        marginLeft: '5px'
                    }}
                >
                    全部消去
                </button>
            </div>

            <div style={{ position: 'relative', marginTop: '15px' }}>
                <canvas
                    ref={canvasRef}
                    className="paint-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                    style={{
                        border: '2px solid #555',
                        backgroundColor: '#ffffff',
                        width: '100%',
                        maxWidth: '400px',
                        aspectRatio: '1/1',
                        touchAction: 'none' // スクロール防止
                    }}
                />
                {isSubmitted && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold'
                    }}>
                        相手の完成を待っています...
                    </div>
                )}
            </div>

            <div style={{ marginTop: '20px' }}>
                <h2 style={{ color: '#fff' }}>相手を驚かせる「顔」を描いてください！</h2>
                <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
                    ※扉が開いたとき、描いた顔が首なしの体に乗って突撃します。
                </p>
            </div>

            <div style={{ marginTop: '20px' }}>
                <button
                    className="btn"
                    onClick={submitDrawing}
                    disabled={isSubmitted || !hasDrawn}
                >
                    {isSubmitted ? '待機中' : '完成！'}
                </button>
            </div>
        </div>
    );
};

export default Paint;
