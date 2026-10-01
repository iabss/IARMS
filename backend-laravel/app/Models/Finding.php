<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class Finding extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'findings';

    protected $fillable = [
        'audit_engagement_id',
        'no',
        'project_audit',
        'site',
        'periode_audit',
        'department',
        'problem_finding',
        'detail_temuan',
        'dokumentasi_temuan',
        'kriteria',
        'kategori',
        'rekomendasi',
        'status',
        'pic_site',
        'pic_ho',
        'due_date',
        'remarks',
        'dokumentasi_closing',
        'reviewed_closing_from_user',
        'reviewed_closing_from_ia',
        'ia_review_notes',
        'ia_reviewed_at',
        'ia_reviewed_by',
        'note',
    ];

    protected $casts = [
        'due_date' => 'date',
        'ia_reviewed_at' => 'datetime',
    ];

    /**
     * Relasi ke Audit Engagement induk.
     */
    public function auditEngagement(): BelongsTo
    {
        return $this->belongsTo(AuditEngagement::class, 'audit_engagement_id');
    }

    /**
     * Scope untuk temuan yang belum direview oleh Internal Audit.
     */
    public function scopePendingIaReview(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->whereNull('reviewed_closing_from_ia')
              ->orWhere('reviewed_closing_from_ia', '')
              ->orWhere('reviewed_closing_from_ia', 'Pending');
        })->whereNotNull('dokumentasi_closing');
    }

    /**
     * Scope untuk temuan berdasarkan site/jobsite.
     */
    public function scopeBySite(Builder $query, ?string $site): Builder
    {
        if ($site && strtoupper($site) !== 'ALL') {
            return $query->where('site', $site);
        }
        return $query;
    }

    /**
     * Scope untuk temuan berdasarkan status (OPEN, CLOSE, IN PROGRESS).
     */
    public function scopeByStatus(Builder $query, ?string $status): Builder
    {
        if ($status && strtoupper($status) !== 'ALL') {
            return $query->where('status', strtoupper($status));
        }
        return $query;
    }
}
