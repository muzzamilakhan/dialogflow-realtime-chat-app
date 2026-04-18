<?php

namespace Tests\Feature;

use App\Models\ChatSession;
use App\Models\User;
use App\Services\DialogflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ])->assertUnauthorized();
    }

    public function test_unauthorized_chat_access_is_blocked(): void
    {
        $this->getJson('/api/chat/sessions')->assertUnauthorized();
    }

    public function test_sessions_endpoint_returns_only_current_user_sessions(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        ChatSession::factory()->count(2)->for($user)->create();
        ChatSession::factory()->for($otherUser)->create();

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/chat/sessions');

        $response->assertOk();
        $this->assertCount(2, $response->json('sessions'));
    }

    public function test_sending_message_stores_user_and_bot_messages(): void
    {
        $user = User::factory()->create();
        $session = ChatSession::factory()->for($user)->create();

        $this->app->instance(DialogflowService::class, new class extends DialogflowService
        {
            public function detectIntent(string $sessionId, string $text): array
            {
                return [
                    'reply' => 'Bot reply',
                    'intent_name' => 'greeting',
                ];
            }
        });

        $response = $this->actingAs($user, 'sanctum')->postJson("/api/chat/sessions/{$session->id}/messages", [
            'message' => 'Hello',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user_message.message', 'Hello')
            ->assertJsonPath('bot_message.message', 'Bot reply');

        $this->assertDatabaseCount('chat_messages', 2);
    }

    public function test_dialogflow_failure_returns_safe_fallback(): void
    {
        $user = User::factory()->create();
        $session = ChatSession::factory()->for($user)->create();

        $this->app->instance(DialogflowService::class, new class extends DialogflowService
        {
            public function detectIntent(string $sessionId, string $text): array
            {
                return [
                    'reply' => 'I am having trouble reaching the assistant right now. Please try again in a moment.',
                    'intent_name' => 'fallback_error',
                ];
            }
        });

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/chat/sessions/{$session->id}/messages", [
                'message' => 'Hello',
            ])
            ->assertOk()
            ->assertJsonPath('bot_message.intent_name', 'fallback_error');
    }
}
