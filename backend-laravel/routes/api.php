<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\FindingController;
use App\Http\Controllers\Api\RiskController;

/*
|--------------------------------------------------------------------------
| IARMS API Routes (Laravel + SQL Server)
|--------------------------------------------------------------------------
|
| Endpoint API seragam untuk integrasi penuh dengan frontend IARMS.
| Menggantikan arsitektur lama Google Apps Script / Google Sheets.
|
*/

Route::prefix('v1')->group(function () {

    // Health check endpoint
    Route::get('/health', function () {
        return response()->json([
            'status' => 'online',
            'database' => 'Microsoft SQL Server (sqlsrv)',
            'timestamp' => now()->toIso8601String()
        ]);
    });

    // 1. Audit Engagements / Proyek Audit
    Route::apiResource('audits', AuditController::class);

    // 2. Finding Statements / Temuan Audit (AFS)
    Route::get('findings/recent-evidence-notifications', [FindingController::class, 'notifications']);
    Route::post('findings/{id}/review-ia', [FindingController::class, 'reviewIa']);
    Route::apiResource('findings', FindingController::class);

    // 3. Risk Register / Manajemen Risiko
    Route::apiResource('risks', RiskController::class);

});
