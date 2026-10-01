<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AuditEngagement extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'audit_engagements';

    protected $fillable = [
        'audit_code',
        'title',
        'department',
        'site',
        'lead_auditor',
        'audit_team',
        'plan_days',
        'act_days',
        'progress',
        'status',
        'start_date',
        'end_date',
        'scope_description',
    ];

    protected $casts = [
        'plan_days' => 'integer',
        'act_days' => 'integer',
        'progress' => 'float',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    /**
     * Relasi ke seluruh temuan (findings) dalam audit ini.
     */
    public function findings(): HasMany
    {
        return $this->hasMany(Finding::class, 'audit_engagement_id');
    }

    /**
     * Relasi ke risiko yang terkait audit ini.
     */
    public function risks(): HasMany
    {
        return $this->hasMany(Risk::class, 'audit_engagement_id');
    }
}
