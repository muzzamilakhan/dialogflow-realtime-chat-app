<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\ChatSession;
use App\Models\ChatMessage;
use App\Services\DialogflowService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ChatController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sessions = $request->user()
            ->chatSessions()
            ->with(['messages' => fn($query) => $query->latest()->limit(1)])
            ->latest('updated_at')
            ->get()
            ->map(function (ChatSession $session) {
                $latestMessage = $session->messages->first();

                return [
                    'id' => $session->id,
                    'title' => $session->title,
                    'status' => $session->status,
                    'updated_at' => $session->updated_at?->toISOString(),
                    'latest_message' => $latestMessage ? [
                        'message' => $latestMessage->message,
                        'sender_type' => $latestMessage->sender_type,
                        'created_at' => $latestMessage->created_at?->toISOString(),
                    ] : null,
                ];
            });

        return response()->json([
            'sessions' => $sessions,
        ]);
    }

    public function storeSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:120'],
        ]);

        $session = ChatSession::create([
            'user_id' => $request->user()->id,
            'title' => $validated['title'] ?: 'New Conversation',
            'status' => 'active',
        ]);

        return response()->json([
            'session' => $this->serializeSession($session),
        ], Response::HTTP_CREATED);
    }

    public function messages(Request $request, ChatSession $session): JsonResponse
    {
        $session = $this->ownedSession($request, $session);

        return response()->json([
            'session' => $this->serializeSession($session),
            'messages' => $session->messages()
                ->orderBy('created_at')
                ->get()
                ->map(fn(ChatMessage $message) => $this->serializeMessage($message)),
        ]);
    }

    public function send(Request $request, ChatSession $session, DialogflowService $dialogflow): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $session = $this->ownedSession($request, $session);

        $userMessage = ChatMessage::create([
            'session_id' => $session->id,
            'user_id' => $request->user()->id,
            'sender_type' => 'user',
            'message' => trim($validated['message']),
        ]);

        if ($session->title === 'New Conversation') {
            $session->forceFill([
                'title' => mb_strimwidth($userMessage->message, 0, 48, '...'),
            ])->save();
        }

        $botReplyPayload = $dialogflow->detectIntent((string) $session->id, $userMessage->message);

        $botMessage = ChatMessage::create([
            'session_id' => $session->id,
            'user_id' => $request->user()->id,
            'sender_type' => 'bot',
            'message' => $botReplyPayload['reply'],
            'intent_name' => $botReplyPayload['intent_name'],
        ]);

        $session->touch();

        return response()->json([
            'session' => $this->serializeSession($session->fresh()),
            'user_message' => $this->serializeMessage($userMessage),
            'bot_message' => $this->serializeMessage($botMessage),
        ]);
    }

    protected function ownedSession(Request $request, ChatSession $session): ChatSession
    {
        abort_if($session->user_id !== $request->user()->id, Response::HTTP_NOT_FOUND);

        return $session;
    }

    protected function serializeSession(ChatSession $session): array
    {
        return [
            'id' => $session->id,
            'title' => $session->title,
            'status' => $session->status,
            'updated_at' => $session->updated_at?->toISOString(),
            'created_at' => $session->created_at?->toISOString(),
        ];
    }

    protected function serializeMessage(ChatMessage $message): array
    {
        return [
            'id' => $message->id,
            'session_id' => $message->session_id,
            'sender_type' => $message->sender_type,
            'message' => $message->message,
            'intent_name' => $message->intent_name,
            'created_at' => $message->created_at?->toISOString(),
        ];
    }
}
