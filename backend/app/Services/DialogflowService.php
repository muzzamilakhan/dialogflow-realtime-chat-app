<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class DialogflowService
{
    public function detectIntent(string $sessionId, string $text): array
    {
        try {
            $response = Http::withToken($this->accessToken())
                ->timeout(20)
                ->post($this->detectIntentUrl($sessionId), [
                    'queryInput' => [
                        'text' => [
                            'text' => $text,
                            'languageCode' => config('services.dialogflow.language', 'en'),
                        ],
                    ],
                ])
                ->throw()
                ->json();

            return [
                'reply' => data_get($response, 'queryResult.fulfillmentText') ?: 'Thanks for your message. I am processing that right now.',
                'intent_name' => data_get($response, 'queryResult.intent.displayName'),
            ];
        } catch (Throwable $exception) {
            Log::error('Dialogflow detectIntent failed.', [
                'message' => $exception->getMessage(),
            ]);

            return [
                'reply' => 'I am having trouble reaching the assistant right now. Please try again in a moment.',
                'intent_name' => 'fallback_error',
            ];
        }
    }

    protected function detectIntentUrl(string $sessionId): string
    {
        $projectId = config('services.dialogflow.project_id');

        return sprintf(
            'https://dialogflow.googleapis.com/v2/projects/%s/agent/sessions/%s:detectIntent',
            $projectId,
            $sessionId
        );
    }

    protected function accessToken(): string
    {
        return Cache::remember('dialogflow_access_token', now()->addMinutes(50), function () {
            $issuedAt = time();
            $privateKey = str_replace('\n', "\n", (string) config('services.dialogflow.private_key'));

            $header = $this->base64UrlEncode(json_encode([
                'alg' => 'RS256',
                'typ' => 'JWT',
            ]));

            $claims = $this->base64UrlEncode(json_encode([
                'iss' => config('services.dialogflow.client_email'),
                'scope' => 'https://www.googleapis.com/auth/cloud-platform',
                'aud' => 'https://oauth2.googleapis.com/token',
                'exp' => $issuedAt + 3600,
                'iat' => $issuedAt,
            ]));

            $unsignedToken = $header.'.'.$claims;

            if (! openssl_sign($unsignedToken, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
                throw new RuntimeException('Unable to sign the Dialogflow JWT assertion.');
            }

            $jwt = $unsignedToken.'.'.$this->base64UrlEncode($signature);

            $tokenResponse = Http::asForm()
                ->timeout(20)
                ->post('https://oauth2.googleapis.com/token', [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $jwt,
                ])
                ->throw()
                ->json();

            $accessToken = data_get($tokenResponse, 'access_token');

            if (! $accessToken) {
                throw new RuntimeException('Dialogflow access token was not returned.');
            }

            return $accessToken;
        });
    }

    protected function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
