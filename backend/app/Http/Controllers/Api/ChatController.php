<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ChatMessage;
use App\Services\DialogflowService;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    public function history(Request $request)
    {
        return ChatMessage::where('user_id', $request->user()->id)->get();
    }

    public function send(Request $request, DialogflowService $bot)
    {
        ChatMessage::create([
            'user_id' => $request->user()->id,
            'sender_type' => 'user',
            'message' => $request->message
        ]);
        Log::info('User message: ' . $request->message);

        $reply = $bot->ask('1', $request->message)['reply'];
        Log::info('Bot reply: ' . $reply);

        ChatMessage::create([
            'user_id' => $request->user()->id,
            'sender_type' => 'bot',
            'message' => $reply
        ]);
        Log::info('Saved bot reply to database.');
        Log::info('Current chat history: ' . ChatMessage::where('user_id', $request->user()->id)->get()->toJson());

        return response()->json([
            'reply' => $reply
        ]);
    }
}
