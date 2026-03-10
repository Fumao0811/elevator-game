import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // 本番では適切なドメインやポートに制限
        methods: ['GET', 'POST'],
    },
});

// APIルーティングの追加 (React等から fetch('/api/health') などで叩ける)
const apiRouter = express.Router();
apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Elevator Game API is running!', timestamp: new Date().toISOString() });
});

// `/api` で始まるリクエストはすべてAPIルーターへ流す
app.use('/api', apiRouter);

// フロントエンドのビルドディレクトリの静的ファイル配信
// 注意: ビルド後は ../client/dist または適切なパスになるため __dirname を基準に解決する
app.use(express.static(path.join(__dirname, '../../client/dist')));

// API以外のすべてのリクエストをReactのindex.htmlに返す (Client-side Routing対策)
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// ゲームの各種型定義
type Role = 'ESCAPE' | 'WAIT';

interface Player {
    id: string; // socket.id
    nickname: string;
    role: Role | null;
    score: number;
    isReady: boolean;
    selectedFloor: number | null; // 今回選択した階層
    lastEscapedFloor: number | null; // 直前に「逃げる側」で選んだ階層
    lastWaitedFloor: number | null; // 直前に「待ち伏せ側」で選んだ階層
    drawnImage: string | null; // 手書きのおばけ画像(Base64)
}

interface RoundHistory {
    round: number;
    turn: 1 | 2;
    escapeNickname: string;
    waitNickname: string;
    escapedFloor: number | null;
    waitedFloor: number | null;
    isCaught: boolean;
}

interface Room {
    roomId: string;
    players: Player[];
    status: 'WAITING' | 'DRAWING' | 'PLAYING' | 'REVEAL' | 'FINISHED';
    round: number; // イニング数 (1〜maxRounds)
    turn: 1 | 2;   // 1=表、2=裏
    maxRounds: number;
    winner: string | null;
    lastRoundCaught: boolean | null; // 直前のラウンドで捕まったか
    lastEscapedFloor: number | null; // 直前のラウンドで逃走した階 (演出用)
    lastWaitedFloor: number | null;  // 直前のラウンドで待ち伏せした階 (演出用)
    history: RoundHistory[];         // これまでのターンの履歴
}

const PORT = process.env.PORT || 3001;

// メモリ上でルームとマッチング状況を管理
const rooms = new Map<string, Room>();
let waitingPlayer: Player | null = null; // ランダムマッチ待機中のプレイヤー

const generateRoomId = () => Math.random().toString(36).substring(2, 9);

io.on('connection', (socket: Socket) => {
    console.log(`User Connected: ${socket.id}`);

    // ランダムマッチング参加
    socket.on('join_random_match', (nickname: string) => {
        const player: Player = {
            id: socket.id,
            nickname,
            role: null,
            score: 0,
            isReady: false,
            selectedFloor: null,
            lastEscapedFloor: null,
            lastWaitedFloor: null,
            drawnImage: null,
        };

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // マッチング成立
            const roomId = generateRoomId();

            // 役割のランダム割り当て
            const isEscapeFirst = Math.random() > 0.5;
            player.role = isEscapeFirst ? 'ESCAPE' : 'WAIT';
            waitingPlayer.role = isEscapeFirst ? 'WAIT' : 'ESCAPE';

            player.lastEscapedFloor = null;
            player.lastWaitedFloor = null;
            waitingPlayer.lastEscapedFloor = null;
            waitingPlayer.lastWaitedFloor = null;

            const newRoom: Room = {
                roomId,
                players: [waitingPlayer, player],
                status: 'DRAWING', // マッチング直後は絵を描くフェーズから開始
                round: 1,
                turn: 1, // 1を表、2を裏とみなす
                maxRounds: 5, // 今回のルールでは5ラウンド=5イニング
                winner: null,
                lastRoundCaught: null, // 初期値
                lastEscapedFloor: null,
                lastWaitedFloor: null,
                history: [],
            };

            rooms.set(roomId, newRoom);

            // お互いをルームに参加させる
            io.sockets.sockets.get(waitingPlayer.id)?.join(roomId);
            socket.join(roomId);

            // マッチング成立を通知
            io.to(roomId).emit('match_found', newRoom);

            console.log(`Match Found: Room ${roomId}`);
            waitingPlayer = null; // 待機状態をリセット

        } else {
            // 誰も待機していなければ待機室に入る
            waitingPlayer = player;
            socket.emit('waiting_for_match');
            console.log(`User ${nickname} is waiting for match`);
        }
    });

    // お絵かきキャンバスの提出アクション
    socket.on('submit_drawing', ({ roomId, imageBase64 }: { roomId: string, imageBase64: string }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];
        if (!player) return;

        player.drawnImage = imageBase64;
        player.isReady = true;

        const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
        const otherPlayer = room.players[otherPlayerIndex];

        // 両者が絵を提出完了した場合、ゲーム（階層選択）フェーズへ
        if (otherPlayer && otherPlayer.isReady) {
            room.status = 'PLAYING';
            // お互いの準備状態をリセットして次のフェーズに対応
            player.isReady = false;
            otherPlayer.isReady = false;

            // 絵が描かれたルーム状態をクライアントに同期
            io.to(roomId).emit('drawing_finished', room);
        } else {
            // 相手を待っている状態
            socket.emit('waiting_for_opponent');
        }
    });

    // 階層選択アクション
    socket.on('select_floor', ({ roomId, floor }: { roomId: string, floor: number }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];
        if (!player) return;

        // 選択状態を保存
        player.selectedFloor = floor;
        player.isReady = true;

        // 相手が完了しているかチェック
        const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
        const otherPlayer = room.players[otherPlayerIndex];

        // 両者が選択完了した場合
        if (otherPlayer && otherPlayer.isReady) {
            room.status = 'REVEAL';

            // カウントダウン開始を通知（フロント側で演出）
            io.to(roomId).emit('both_ready_countdown');

            // 演出のためサーバーから遅延して判定結果（REVEAL）を送るなど調整可能
            setTimeout(() => {
                calculateRoundResult(room);
                io.to(roomId).emit('round_result', room);
            }, 3000); // 3秒後（ドンッ！）
        } else {
            // 相手を待っている状態を通知
            socket.emit('waiting_for_opponent');
        }
    });

    // 勝敗計算・次ラウンドの準備
    const calculateRoundResult = (room: Room) => {
        const p1 = room.players[0];
        const p2 = room.players[1];
        if (!p1 || !p2) return;

        // 役割に基づきプレイヤーを判別
        const escaper = p1.role === 'ESCAPE' ? p1 : p2;
        const waiter = p1.role === 'WAIT' ? p1 : p2;

        if (!escaper || !waiter) return;

        // 同一階層なら待ち伏せ側の勝利（捕獲成功）
        if (escaper.selectedFloor === waiter.selectedFloor) {
            // 捕獲された場合、逃ける側の得点はなし
            room.lastRoundCaught = true;
            room.lastEscapedFloor = escaper.selectedFloor;
            room.lastWaitedFloor = waiter.selectedFloor;
        } else {
            // 逃走成功
            room.lastRoundCaught = false;
            room.lastEscapedFloor = escaper.selectedFloor;
            room.lastWaitedFloor = waiter.selectedFloor;
            if (escaper.selectedFloor !== null) {
                escaper.score += escaper.selectedFloor;
            }
        }

        // 履歴に保存
        room.history.push({
            round: room.round,
            turn: room.turn,
            escapeNickname: escaper.nickname,
            waitNickname: waiter.nickname,
            escapedFloor: escaper.selectedFloor,
            waitedFloor: waiter.selectedFloor,
            isCaught: escaper.selectedFloor === waiter.selectedFloor
        });

        // 制限用に今回選んだ階層を記録
        if (escaper.selectedFloor !== null) escaper.lastEscapedFloor = escaper.selectedFloor;
        if (waiter.selectedFloor !== null) waiter.lastWaitedFloor = waiter.selectedFloor;

        // 役割交代とステートの初期化
        escaper.role = 'WAIT';
        waiter.role = 'ESCAPE';
        p1.isReady = false;
        p2.isReady = false;
        p1.selectedFloor = null;
        p2.selectedFloor = null;

        // ラウンド(イニング)とターン(表裏)の進行
        if (room.turn === 1) {
            room.turn = 2; // 裏へ
        } else {
            room.round += 1; // 次のイニングへ
            room.turn = 1;   // 表に戻る
        }

        // 全ラウンド終了または特定ポイント達成時
        if (room.round > room.maxRounds || p1.score >= 30 || p2.score >= 30) {
            room.status = 'FINISHED';
            if (p1.score > p2.score) room.winner = p1.id;
            else if (p2.score > p1.score) room.winner = p2.id;
            else room.winner = 'DRAW';
        } else {
            room.status = 'PLAYING';
        }
    };

    // 次のラウンドへの準備完了アクション（同期進行用）
    socket.on('ready_next_round', ({ roomId }: { roomId: string }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        player.isReady = true;

        const otherPlayer = room.players.find(p => p.id !== socket.id);

        // 両者が完了した場合
        if (otherPlayer && otherPlayer.isReady) {
            player.isReady = false;
            otherPlayer.isReady = false;

            // 既にFINISHEDなら何もしない、それ以外はPLAYINGに戻ってフロントに通知
            if (room.status !== 'FINISHED') {
                room.status = 'PLAYING';
                io.to(roomId).emit('start_next_round', room);
            }
        } else {
            // 相手を待っている状態
            socket.emit('waiting_for_opponent_next_round');
        }
    });


    // 切断時の処理
    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);

        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }

        // ルームに入っていた場合の処理
        const roomEntry = Array.from(rooms.entries()).find(([_, room]) =>
            room.players.some(p => p.id === socket.id)
        );

        if (roomEntry) {
            const [roomId, room] = roomEntry;
            io.to(roomId).emit('opponent_disconnected');
            rooms.delete(roomId);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
