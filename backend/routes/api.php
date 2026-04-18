<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::prefix('chat')->group(function () {
        Route::get('/sessions', [ChatController::class, 'index']);
        Route::post('/sessions', [ChatController::class, 'storeSession']);
        Route::get('/sessions/{session}/messages', [ChatController::class, 'messages']);
        Route::post('/sessions/{session}/messages', [ChatController::class, 'send']);
    });
});
