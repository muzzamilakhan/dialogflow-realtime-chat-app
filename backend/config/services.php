<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'dialogflow' => [
        'project_id' => env('DIALOGFLOW_PROJECT_ID'),
        'client_email' => env('DIALOGFLOW_CLIENT_EMAIL'),
        'private_key' => env('DIALOGFLOW_PRIVATE_KEY'),
        'credentials_path' => env('DIALOGFLOW_CREDENTIALS_PATH'),
        'ca_bundle_path' => env('DIALOGFLOW_CA_BUNDLE_PATH'),
        'language' => env('DIALOGFLOW_LANGUAGE', 'en'),
    ],

];
