import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '../App';
interface Props { appState: AppState; }
const Paint: React.FC<Props> = ({ appState }) => {
    const { socket, room, setRoom } = appState;
    const navigate = useNavigate();
    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    
    // Tools State
    const [currentColor, setCurrentColor] = useState('#000000');
    const [isEraser, setIsEraser] = useState(false);
    const [lineWidth, setLineWidth] = useState<number>(8);
    const [timeLeft, setTimeLeft] = useState(60);
    const [splashStep, setSplashStep] = useState(1);
    
    // Outline & UI State
    const [selectedOutline, setSelectedOutline] = useState<string>('none');
    const [outlineBgColor, setOutlineBgColor] = useState<string>('#ffffff');
    const [tab, setTab] = useState<'outline' | 'paint'>('outline');
    
    useEffect(() => {
        if (!socket || !room) { navigate('/'); return; }
        const handleDrawingFinished = (updatedRoom: any) => { setRoom(updatedRoom); navigate('/game'); };
        socket.on('drawing_finished', handleDrawingFinished);
        return () => { socket.off('drawing_finished', handleDrawingFinished); };
    }, [socket, room, navigate, setRoom]);
    
    useEffect(() => {
        if (isSubmitted || splashStep === 1) return;
        if (timeLeft <= 0) { submitDrawing(); return; }
        const timerId = setTimeout(() => { setTimeLeft(prev => prev - 1); }, 1000);
        return () => clearTimeout(timerId);
    }, [timeLeft, isSubmitted, splashStep]);

    useEffect(() => {
        if (splashStep === 1) {
            const timer = setTimeout(() => { setSplashStep(0); }, 2500);
            return () => clearTimeout(timer);
        }
    }, [splashStep]);
    
    useEffect(() => {
        const bgCanvas = bgCanvasRef.current;
        if (!bgCanvas) return;
        const ctx = bgCanvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        if (selectedOutline === 'none') return;
        
        const width = bgCanvas.width;
        const height = bgCanvas.height;
        ctx.fillStyle = outlineBgColor;
        
        ctx.strokeStyle = outlineBgColor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const cx = width / 2;
        const cy = height / 2;

        if (selectedOutline === 'round') {
            ctx.arc(cx, cy, width * 0.4, 0, Math.PI * 2);
        } else if (selectedOutline === 'oval') {
            ctx.ellipse(cx, cy, width * 0.35, height * 0.45, 0, 0, Math.PI * 2);
        } else if (selectedOutline === 'alien') {
            ctx.moveTo(cx, cy - height * 0.4);
            ctx.quadraticCurveTo(cx + width * 0.4, cy - height * 0.4, cx + width * 0.4, cy + height * 0.1);
            ctx.quadraticCurveTo(cx + width * 0.2, cy + height * 0.45, cx, cy + height * 0.45);
            ctx.quadraticCurveTo(cx - width * 0.2, cy + height * 0.45, cx - width * 0.4, cy + height * 0.1);
            ctx.quadraticCurveTo(cx - width * 0.4, cy - height * 0.4, cx, cy - height * 0.4);
        } else if (selectedOutline === 'ghost') {
            ctx.moveTo(cx - width * 0.35, cy + height * 0.4);
            ctx.lineTo(cx - width * 0.35, cy);
            ctx.arc(cx, cy, width * 0.35, Math.PI, 0);
            ctx.lineTo(cx + width * 0.35, cy + height * 0.4);
            ctx.lineTo(cx + width * 0.2, cy + height * 0.3);
            ctx.lineTo(cx, cy + height * 0.4);
            ctx.lineTo(cx - width * 0.2, cy + height * 0.3);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
    }, [selectedOutline, outlineBgColor]);

    useEffect(() => {
        const drawCanvas = drawCanvasRef.current;
        if (drawCanvas) {
            drawCanvas.width = 400; drawCanvas.height = 400;
            const ctx = drawCanvas.getContext('2d');
            if (ctx) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
        }
    }, []);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        const canvas = drawCanvasRef.current;
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
        const ctx = drawCanvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            if (isEraser) { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = lineWidth; }
            else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = currentColor; ctx.lineWidth = lineWidth; }
            ctx.beginPath(); ctx.moveTo(x, y);
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || isSubmitted) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = drawCanvasRef.current?.getContext('2d');
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    };

    const endDrawing = () => { setIsDrawing(false); drawCanvasRef.current?.getContext('2d')?.closePath(); };

    const clearCanvas = () => {
        if (isSubmitted) return;
        const canvas = drawCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
            setHasDrawn(false); 
        }
    };

    const submitDrawing = () => {
        if (isSubmitted || !socket || !room) return;
        setIsSubmitted(true);

        const dummyAudio = new Audio('/scare_sound.mp3');
        dummyAudio.volume = 0;
        dummyAudio.play().then(() => { dummyAudio.pause(); dummyAudio.currentTime = 0; }).catch(e => console.log('Audio Blocked:', e));
        
        const bgCanvas = bgCanvasRef.current;
        const drawCanvas = drawCanvasRef.current;
        if (bgCanvas && drawCanvas) {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 400; finalCanvas.height = 400;
            const ctx = finalCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(bgCanvas, 0, 0);
                ctx.drawImage(drawCanvas, 0, 0);
            }
            socket.emit('submit_drawing', { roomId: room.roomId, imageBase64: finalCanvas.toDataURL('image/png') });
        }
    };

    if (splashStep === 1) {
        return (
            <div className="screen-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
                <h1 style={{ fontSize: '2.5rem', color: '#fff', textAlign: 'center', animation: 'scaleUpSplash 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards', padding: '0 20px', lineHeight: '1.5' }}>
                    今から絵を描いてください
                </h1>
            </div>
        );
    }

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ color: '#fff' }}>おばけを描け！</h2>
            <p style={{ color: '#aaa', margin: '5px 0' }}>扉が開いた時に相手を驚かす絵です</p>
            {!isSubmitted && <h3 style={{ color: timeLeft <= 5 ? '#ff4444' : '#fff', margin: '5px 0' }}>残り時間: {timeLeft}秒</h3>}
            
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                <button onClick={() => setTab('outline')} style={{ padding: '8px 16px', backgroundColor: tab === 'outline' ? '#4a9aff' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>輪郭・背景</button>
                <button onClick={() => setTab('paint')} style={{ padding: '8px 16px', backgroundColor: tab === 'paint' ? '#ff4a5a' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>ペン・消しゴム</button>
            </div>

            {tab === 'outline' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{ color: '#aaa', fontSize: '0.9rem', width: '100%', textAlign: 'center' }}>輪郭の種類:</span>
                        {['none', 'round', 'oval', 'alien', 'ghost'].map(type => {
                            const labels: Record<string, string> = { none: 'なし', round: '丸顔', oval: '卵型', alien: '宇宙人', ghost: 'おばけ' };
                            return (
                                <button key={type} onClick={() => setSelectedOutline(type)} style={{ padding: '6px 12px', backgroundColor: selectedOutline === type ? '#fff' : '#444', color: selectedOutline === type ? '#000' : '#fff', border: '2px solid #555', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>{labels[type]}</button>
                            );
                        })}
                    </div>
                    {selectedOutline !== 'none' && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '5px' }}>
                            <span style={{ color: '#aaa', fontSize: '0.9rem', width: '100%', textAlign: 'center' }}>輪郭の顔色:</span>
                            {['#ffffff', '#ffcc99', '#ffb6c1', '#add8e6', '#90ee90', '#ffff00'].map(color => (
                                <button key={color} onClick={() => setOutlineBgColor(color)} style={{ width: '30px', height: '30px', backgroundColor: color, borderRadius: '50%', border: outlineBgColor === color ? '3px solid #ff4a5a' : '2px solid #555', cursor: 'pointer', boxShadow: outlineBgColor === color ? '0 0 10px rgba(255,100,100,0.8)' : 'none' }} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'paint' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                         <span style={{ color: '#aaa', fontSize: '0.9rem' }}>色:</span>
                        {[{ color: '#000000', label: '黒' }, { color: '#ffcc99', label: '肌' }, { color: '#ffffff', label: '白' }, { color: '#ff4a5a', label: '赤' }, { color: '#4aff4a', label: '緑' }, { color: '#4a9aff', label: '青' }, { color: '#ffff4a', label: '黄' }].map((pen) => (
                            <button
                                key={pen.color} onClick={() => { setIsEraser(false); setCurrentColor(pen.color); }}
                                style={{ width: '25px', height: '25px', backgroundColor: pen.color, borderRadius: '50%', border: 'none', cursor: 'pointer', boxShadow: (!isEraser && currentColor === pen.color) ? '0 0 0 3px #aaa' : 'none', transition: 'all 0.2s' }}
                            />
                        ))}
                        <button onClick={() => setIsEraser(true)} style={{ padding: '4px 8px', backgroundColor: '#333', color: '#fff', border: isEraser ? '2px solid #fff' : '2px solid #555', borderRadius: '6px', cursor: 'pointer', marginLeft: '5px', fontSize: '0.9rem' }}>消しゴム</button>
                        <button onClick={clearCanvas} style={{ padding: '4px 8px', backgroundColor: '#8b0000', color: '#fff', border: '2px solid #ff4a5a', borderRadius: '6px', cursor: 'pointer', marginLeft: 'auto', fontSize: '0.9rem' }}>全消去</button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', padding: '0 5px' }}>
                        <span style={{ color: '#aaa', fontSize: '0.9rem', width: '50px' }}>筆太さ:</span>
                        <input type="range" min="2" max="40" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ color: '#fff', width: '30px', textAlign: 'right', fontSize: '0.9rem' }}>{lineWidth}</span>
                    </div>
                </div>
            )}

            <div style={{ position: 'relative', marginTop: '15px', width: '100%', maxWidth: '400px', aspectRatio: '1/1', border: '2px solid #555', backgroundColor: '#222', backgroundImage: 'conic-gradient(#333 90deg, #2a2a2a 90deg 180deg, #333 180deg 270deg, #2a2a2a 270deg)', backgroundSize: '20px 20px', borderRadius: '4px', overflow: 'hidden' }}>
                <canvas ref={bgCanvasRef} width={400} height={400} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }} />
                <canvas ref={drawCanvasRef} width={400} height={400} 
                    onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} 
                    onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }} />
                {isSubmitted && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', zIndex: 10 }}>相手の完成を待っています...</div>}
            </div>
            
            <div style={{ marginTop: '20px' }}>
                <button className="btn" onClick={submitDrawing} disabled={isSubmitted || (!hasDrawn && selectedOutline === 'none')} style={{ fontSize: '1.2rem', padding: '15px 40px' }}>{isSubmitted ? '待機中...' : '完成して送信！'}</button>
            </div>
        </div>
    );
};
export default Paint;
