<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Google\Auth\HttpHandler\Guzzle7HttpHandler;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class DialogflowService
{
    public function detectIntent(string $sessionId, string $text): array
    {
        try {
            $response = Http::withOptions($this->httpOptions())
                ->withToken($this->accessToken())
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
            $this->configureCaBundle();

            $credentials = new ServiceAccountCredentials(
                ['https://www.googleapis.com/auth/cloud-platform'],
                $this->serviceAccountConfig()
            );

            $tokenResponse = $credentials->fetchAuthToken(
                new Guzzle7HttpHandler(new Client($this->httpOptions()))
            );
            $accessToken = data_get($tokenResponse, 'access_token');

            if (! $accessToken) {
                throw new RuntimeException('Dialogflow access token was not returned.');
            }

            return $accessToken;
        });
    }

    protected function serviceAccountConfig(): array|string
    {
        $jsonCredentials = config('services.dialogflow.credentials_json');

        if (is_string($jsonCredentials) && trim($jsonCredentials) !== '') {
            $decoded = json_decode($jsonCredentials, true);

            if (! is_array($decoded)) {
                throw new RuntimeException('Dialogflow credentials JSON is invalid.');
            }

            return $decoded;
        }

        $base64Credentials = config('services.dialogflow.credentials_base64');

        if (is_string($base64Credentials) && trim($base64Credentials) !== '') {
            $decoded = base64_decode($base64Credentials, true);

            if (! is_string($decoded) || $decoded === '') {
                throw new RuntimeException('Dialogflow base64 credentials could not be decoded.');
            }

            $json = json_decode($decoded, true);

            if (! is_array($json)) {
                throw new RuntimeException('Dialogflow base64 credentials JSON is invalid.');
            }

            return $json;
        }

        $credentialsPath = config('services.dialogflow.credentials_path');

        if (is_string($credentialsPath) && $credentialsPath !== '') {
            if (! is_file($credentialsPath)) {
                throw new RuntimeException('Dialogflow credentials file was not found.');
            }

            return $credentialsPath;
        }

        $privateKey = str_replace('\n', "\n", (string) config('services.dialogflow.private_key'));

        if (Str::of($privateKey)->trim()->isEmpty()) {
            throw new RuntimeException('Dialogflow private key is not configured.');
        }

        return [
            'type' => 'service_account',
            'project_id' => config('services.dialogflow.project_id'),
            'private_key' => $privateKey,
            'client_email' => config('services.dialogflow.client_email'),
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ];
    }

    protected function httpOptions(): array
    {
        $this->configureCaBundle();

        $caBundlePath = config('services.dialogflow.ca_bundle_path');

        if (is_string($caBundlePath) && is_file($caBundlePath)) {
            return ['verify' => $caBundlePath];
        }

        return [];
    }

    protected function configureCaBundle(): void
    {
        $caBundlePath = config('services.dialogflow.ca_bundle_path');

        if (! is_string($caBundlePath) || ! is_file($caBundlePath)) {
            return;
        }

        ini_set('curl.cainfo', $caBundlePath);
        ini_set('openssl.cafile', $caBundlePath);
        putenv("SSL_CERT_FILE={$caBundlePath}");
        putenv("CURL_CA_BUNDLE={$caBundlePath}");
    }
}
