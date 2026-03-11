import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';

interface Props { appState: AppState; }

const Paint: React.FC<Props> = ({ appState }) => {
    const { socket, room, setRoom } = appState;
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [currentColor, setCurrentColor] = useState('#000000');
    const [isEraser, setIsEraser] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (!socket || !room) { navigate('/'); return; }
        const handleDrawingFinished = (updatedRoom: any) => { setRoom(updatedRoom); navigate('/game'); };
        socket.on('drawing_finished', handleDrawingFinished);
        return () => { socket.off('drawing_finished', handleDrawingFinished); };
    }, [socket, room, navigate, setRoom]);

    useEffect(() => {
        if (isSubmitted) return;
        if (timeLeft <= 0) { submitDrawing(); return; }
        const timerId = setTimeout(() => { setTimeLeft(prev => prev - 1); }, 1000);
        return () => clearTimeout(timerId);
    }, [timeLeft, isSubmitted]);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        let clientX, clientY;
        if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
        else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
        const rect = canvas.getBoundingClientRect();
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (isSubmitted) return;
        setIsDrawing(true);
        setHasDrawn(true);
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            if (isEraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 20; } 
            else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = currentColor; ctx.lineWidth = 8; }
            ctx.beginPath(); ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || isSubmitted) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    };

    const endDrawing = () => { setIsDrawing(false); canvasRef.current?.getContext('2d')?.closePath(); };

    const clearCanvas = () => {
        if (isSubmitted) return;
        const canvas = canvasRef.current;
        if (canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); setHasDrawn(false); }
    };

    const submitDrawing = () => {
        if (isSubmitted || !socket || !room) return;
        setIsSubmitted(true);
        
        // ★ここでユーザーがボタンを押した瞬間に音をダミー再生させ、「音声ブロック」を解除させる必殺技
        const dummyAudio = new Audio('/scare_sound.mp3');
        dummyAudio.volume = 0; // 音は出さない
        dummyAudio.play().then(() => { dummyAudio.pause(); dummyAudio.currentTime = 0; }).catch(e => console.log('Audio Blocked:', e));

        const canvas = canvasRef.current;
        if (canvas) {
            const tempCanvas = document.createElement('canvas'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) {
                // 背景の白を「透明」に変換して送る
                tCtx.drawImage(canvas, 0, 0);
                const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) data[i+3] = 0;
                }
                tCtx.putImageData(imageData, 0, 0);
            }
            socket.emit('submit_drawing', { roomId: room.roomId, imageBase64: tempCanvas.toDataURL('image/png') });
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = 400; canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
        }
    }, [currentColor]);

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff' }}>おばけを描け！</h2>
            <p style={{ color: '#aaa', margin: '5px 0' }}>扉が開いた時に相手を驚かす絵です</p>
            {!isSubmitted && <h3 style={{ color: timeLeft <= 5 ? '#ff4444' : '#fff' }}>残り時間: {timeLeft}秒</h3>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                <span style={{ color: '#aaa', fontSize: '0.9rem', marginRight: '5px' }}>ツール:</span>
                {[{ color: '#000000', label: '黒' }, { color: '#ffcc99', label: '肌' }, { color: '#ff4a5a', label: '赤' }, { color: '#4aff4a', label: '緑' }, { color: '#4a9aff', label: '青' }, { color: '#ffff4a', label: '黄' }].map((pen) => (
                    <button
                        key={pen.color} onClick={() => { setIsEraser(false); setCurrentColor(pen.color); }}
                        style={{ width: '30px', height: '30px', backgroundColor: pen.color, borderRadius: '50%', border: 'none', cursor: 'pointer', boxShadow: (!isEraser && currentColor === pen.color) ? '0 0 0 3px #fff' : 'none', transition: 'all 0.2s' }}
                    />
                ))}
                <button onClick={() => setIsEraser(true)} style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: isEraser ? '2px solid #fff' : '2px solid #555', borderRadius: '6px', cursor: 'pointer', marginLeft: '10px' }}>消しゴム</button>
                <button onClick={clearCanvas} style={{ padding: '6px 12px', backgroundColor: '#8b0000', color: '#fff', border: '2px solid #ff4a5a', borderRadius: '6px', cursor: 'pointer', marginLeft: '5px' }}>全部消去</button>
            </div>
            <div style={{ position: 'relative', marginTop: '15px' }}>
                <canvas ref={canvasRef} className="paint-canvas" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} style={{ border: '2px solid #555', backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', aspectRatio: '1/1', touchAction: 'none' }} />
                {isSubmitted && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>相手の完成を待っています...</div>}
            </div>
            <div style={{ marginTop: '20px' }}><h2 style={{ color: '#fff' }}>相手を驚かせる「顔」を描いてください！</h2><p style={{ color: '#aaa', fontSize: '0.9rem' }}>※扉が開いたとき、描いた顔が首なしの体に乗って突撃します。</p></div>
            <div style={{ marginTop: '20px' }}>
                <button className="btn" onClick={submitDrawing} disabled={isSubmitted || !hasDrawn}>{isSubmitted ? '待機中' : '完成！'}</button>
            </div>
        </div>
    );
};
export default Paint;
