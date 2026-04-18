<?php

namespace App\Services;

class DialogflowService
{
    public function ask($sessionId, $text)
    {
        return [
            'reply' => 'Bot reply: ' . $text
        ];
    }
}
