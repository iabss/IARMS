<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Risk extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'risks';

    protected $fillable = [
        'risk_id',
        'audit_engagement_id',
        'department',
        'site',
        'risk_category',
        'risk_event',
        'root_cause',
        'risk_impact',
        'likelihood',
        'impact',
        'inherent_score',
        'inherent_level',
        'existing_controls',
        'control_effectiveness',
        'residual_likelihood',
        'residual_impact',
        'residual_score',
        'residual_level',
        'treatment_plan',
        'risk_owner',
        'target_completion_date',
        'status',
    ];

    protected $casts = [
        'likelihood' => 'integer',
        'impact' => 'integer',
        'inherent_score' => 'integer',
        'residual_likelihood' => 'integer',
        'residual_impact' => 'integer',
        'residual_score' => 'integer',
        'target_completion_date' => 'date',
    ];

    /**
     * Hitung skor risiko otomatis (Likelihood x Impact) sebelum disimpan.
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($risk) {
            // Inherent Risk Score & Level
            $risk->inherent_score = ($risk->likelihood ?: 1) * ($risk->impact ?: 1);
            $risk->inherent_level = self::calculateRiskLevel($risk->inherent_score);

            // Residual Risk Score & Level
            $resLikelihood = $risk->residual_likelihood ?: $risk->likelihood;
            $resImpact = $risk->residual_impact ?: $risk->impact;
            $risk->residual_score = $resLikelihood * $resImpact;
            $risk->residual_level = self::calculateRiskLevel($risk->residual_score);
        });
    }

    /**
     * Evaluasi tingkat risiko berdasarkan matriks 5x5 standar ISO 31000.
     */
    public static function calculateRiskLevel(int $score): string
    {
        if ($score >= 15) return 'Extreme';
        if ($score >= 10) return 'High';
        if ($score >= 5)  return 'Medium';
        return 'Low';
    }

    public function auditEngagement(): BelongsTo
    {
        return $this->belongsTo(AuditEngagement::class, 'audit_engagement_id');
    }
}
