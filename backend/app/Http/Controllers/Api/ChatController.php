<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ChatMessage;
use App\Services\DialogflowService;

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

        $reply = $bot->ask('1', $request->message)['reply'];

        ChatMessage::create([
            'user_id' => $request->user()->id,
            'sender_type' => 'bot',
            'message' => $reply
        ]);

        return response()->json([
            'reply' => $reply
        ]);
    }
}
