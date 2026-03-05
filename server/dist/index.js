"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // 本番では適切なドメインやポートに制限
        methods: ['GET', 'POST'],
    },
});
// APIルーティングの追加 (React等から fetch('/api/health') などで叩ける)
const apiRouter = express_1.default.Router();
apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Elevator Game API is running!', timestamp: new Date().toISOString() });
});
// `/api` で始まるリクエストはすべてAPIルーターへ流す
app.use('/api', apiRouter);
// フロントエンドのビルドディレクトリの静的ファイル配信
// 注意: ビルド後は ../client/dist または適切なパスになるため __dirname を基準に解決する
app.use(express_1.default.static(path_1.default.join(__dirname, '../../client/dist')));
// API以外のすべてのリクエストをReactのindex.htmlに返す (Client-side Routing対策)
app.get('/*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../client/dist/index.html'));
});
const PORT = process.env.PORT || 3001;
// メモリ上でルームとマッチング状況を管理
const rooms = new Map();
let waitingPlayer = null; // ランダムマッチ待機中のプレイヤー
const generateRoomId = () => Math.random().toString(36).substring(2, 9);
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);
    // ランダムマッチング参加
    socket.on('join_random_match', (nickname) => {
        var _a;
        const player = {
            id: socket.id,
            nickname,
            role: null,
            score: 0,
            isReady: false,
            selectedFloor: null,
            drawnImage: null,
        };
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // マッチング成立
            const roomId = generateRoomId();
            // 役割のランダム割り当て
            const isEscapeFirst = Math.random() > 0.5;
            player.role = isEscapeFirst ? 'ESCAPE' : 'WAIT';
            waitingPlayer.role = isEscapeFirst ? 'WAIT' : 'ESCAPE';
            const newRoom = {
                roomId,
                players: [waitingPlayer, player],
                status: 'DRAWING', // マッチング直後は絵を描くフェーズから開始
                round: 1,
                maxRounds: 5, // 今回のルールでは5ラウンド
                winner: null,
                lastRoundCaught: null, // 初期値
            };
            rooms.set(roomId, newRoom);
            // お互いをルームに参加させる
            (_a = io.sockets.sockets.get(waitingPlayer.id)) === null || _a === void 0 ? void 0 : _a.join(roomId);
            socket.join(roomId);
            // マッチング成立を通知
            io.to(roomId).emit('match_found', newRoom);
            console.log(`Match Found: Room ${roomId}`);
            waitingPlayer = null; // 待機状態をリセット
        }
        else {
            // 誰も待機していなければ待機室に入る
            waitingPlayer = player;
            socket.emit('waiting_for_match');
            console.log(`User ${nickname} is waiting for match`);
        }
    });
    // お絵かきキャンバスの提出アクション
    socket.on('submit_drawing', ({ roomId, imageBase64 }) => {
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1)
            return;
        const player = room.players[playerIndex];
        if (!player)
            return;
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
        }
        else {
            // 相手を待っている状態
            socket.emit('waiting_for_opponent');
        }
    });
    // 階層選択アクション
    socket.on('select_floor', ({ roomId, floor }) => {
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1)
            return;
        const player = room.players[playerIndex];
        if (!player)
            return;
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
        }
        else {
            // 相手を待っている状態を通知
            socket.emit('waiting_for_opponent');
        }
    });
    // 勝敗計算・次ラウンドの準備
    const calculateRoundResult = (room) => {
        const p1 = room.players[0];
        const p2 = room.players[1];
        if (!p1 || !p2)
            return;
        // 役割に基づきプレイヤーを判別
        const escaper = p1.role === 'ESCAPE' ? p1 : p2;
        const waiter = p1.role === 'WAIT' ? p1 : p2;
        if (!escaper || !waiter)
            return;
        // 同一階層なら待ち伏せ側の勝利（捕獲成功）
        if (escaper.selectedFloor === waiter.selectedFloor) {
            // 捕獲された場合、逃ける側の得点はなし
            room.lastRoundCaught = true;
        }
        else {
            // 逃走成功
            room.lastRoundCaught = false;
            if (escaper.selectedFloor !== null) {
                escaper.score += escaper.selectedFloor;
            }
        }
        // 役割交代とステートの初期化
        escaper.role = 'WAIT';
        waiter.role = 'ESCAPE';
        p1.isReady = false;
        p2.isReady = false;
        p1.selectedFloor = null;
        p2.selectedFloor = null;
        room.round += 1;
        // 全ラウンド終了または特定ポイント達成時
        if (room.round > room.maxRounds || p1.score >= 30 || p2.score >= 30) {
            room.status = 'FINISHED';
            if (p1.score > p2.score)
                room.winner = p1.id;
            else if (p2.score > p1.score)
                room.winner = p2.id;
            else
                room.winner = 'DRAW';
        }
        else {
            room.status = 'PLAYING';
        }
    };
    // 切断時の処理
    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        // ルームに入っていた場合の処理
        const roomEntry = Array.from(rooms.entries()).find(([_, room]) => room.players.some(p => p.id === socket.id));
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
