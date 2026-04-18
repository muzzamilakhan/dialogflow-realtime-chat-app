<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Http;

class DialogflowService
{
    public function ask($sessionId, $text)
    {
        $scopes = [
            'https://www.googleapis.com/auth/cloud-platform'
        ];

        $credentials = new ServiceAccountCredentials(
            $scopes,
            [
                "type" => "service_account",
                "client_email" => env('DIALOGFLOW_CLIENT_EMAIL'),
                "private_key" => str_replace('\\n', "\n", env('DIALOGFLOW_PRIVATE_KEY')),
            ]
        );

        $tokenData = $credentials->fetchAuthToken();
        $token = $tokenData['access_token'];

        $url = "https://dialogflow.googleapis.com/v2/projects/"
            . env('DIALOGFLOW_PROJECT_ID')
            . "/agent/sessions/"
            . $sessionId
            . ":detectIntent";

        $response = Http::withOptions([
            'verify' => false,
        ])->withToken($token)->post($url, [
                    "queryInput" => [
                        "text" => [
                            "text" => $text,
                            "languageCode" => env('DIALOGFLOW_LANGUAGE', 'en')
                        ]
                    ]
                ]);

        if (!$response->successful()) {
            return [
                "reply" => "Bot unavailable."
            ];
        }

        return [
            "reply" => data_get(
                $response->json(),
                'queryResult.fulfillmentText',
                'No response'
            )
        ];
    }
}
