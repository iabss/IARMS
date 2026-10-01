<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for SQL Server (sqlsrv).
     */
    public function up(): void
    {
        // 1. Tabel Audit Engagements / Proyek Audit
        Schema::create('audit_engagements', function (Blueprint $table) {
            $table->id();
            $table->string('audit_code', 50)->unique();
            $table->string('title', 255);
            $table->string('department', 100)->nullable();
            $table->string('site', 50)->default('HEAD OFFICE');
            $table->string('lead_auditor', 100);
            $table->text('audit_team')->nullable(); // JSON atau string daftar auditor
            $table->integer('plan_days')->default(0);
            $table->integer('act_days')->default(0);
            $table->decimal('progress', 5, 2)->default(0.00);
            $table->string('status', 50)->default('On-Going'); // Planned, On-Going, Completed, Overdue
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->text('scope_description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['site', 'status']);
        });

        // 2. Tabel Finding Statements / Temuan Audit (AFS)
        Schema::create('findings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_engagement_id')->nullable()->constrained('audit_engagements')->nullOnDelete();
            $table->string('no', 50); // Nomor urut temuan
            $table->string('project_audit', 150);
            $table->string('site', 50);
            $table->string('periode_audit', 100)->nullable();
            $table->string('department', 100)->nullable();
            $table->text('problem_finding'); // Problem / Finding utama
            $table->text('detail_temuan'); // Detail temuan
            $table->text('dokumentasi_temuan')->nullable(); // Link / File bukti temuan awal
            $table->string('kriteria', 100)->nullable(); // DO, SOP, Undang-Undang, dll.
            $table->enum('kategori', ['MAJOR', 'MINOR', 'IMPROVEMENT'])->default('MAJOR');
            $table->text('rekomendasi');
            $table->enum('status', ['OPEN', 'CLOSE', 'IN PROGRESS'])->default('OPEN');
            $table->string('pic_site', 150)->nullable();
            $table->string('pic_ho', 150)->nullable();
            $table->date('due_date')->nullable();
            $table->string('remarks', 50)->nullable(); // DONE, OVERDUE, IN PROGRESS
            $table->text('dokumentasi_closing')->nullable(); // Link bukti closing CCP
            $table->string('reviewed_closing_from_user', 100)->nullable();
            $table->string('reviewed_closing_from_ia', 100)->nullable(); // Status Review IA (Approve, Reject, Pending)
            $table->text('ia_review_notes')->nullable();
            $table->timestamp('ia_reviewed_at')->nullable();
            $table->string('ia_reviewed_by', 100)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_audit', 'site']);
            $table->index('status');
            $table->index('kategori');
            $table->index('due_date');
        });

        // 3. Tabel Risk Register / Manajemen Risiko
        Schema::create('risks', function (Blueprint $table) {
            $table->id();
            $table->string('risk_id', 50)->unique();
            $table->foreignId('audit_engagement_id')->nullable()->constrained('audit_engagements')->nullOnDelete();
            $table->string('department', 100);
            $table->string('site', 50)->default('HEAD OFFICE');
            $table->string('risk_category', 100); // Operasional, Finansial, Kepatuhan, Strategis, IT
            $table->text('risk_event'); // Peristiwa Risiko
            $table->text('root_cause')->nullable(); // Penyebab Utama
            $table->text('risk_impact')->nullable(); // Dampak Risiko
            
            // Inherent Risk
            $table->integer('likelihood')->default(1); // 1-5
            $table->integer('impact')->default(1); // 1-5
            $table->integer('inherent_score')->default(1); // likelihood * impact
            $table->string('inherent_level', 50)->default('Low'); // Low, Medium, High, Extreme

            // Existing Control & Residual Risk
            $table->text('existing_controls')->nullable();
            $table->enum('control_effectiveness', ['Effective', 'Partially Effective', 'Ineffective'])->default('Effective');
            $table->integer('residual_likelihood')->default(1);
            $table->integer('residual_impact')->default(1);
            $table->integer('residual_score')->default(1);
            $table->string('residual_level', 50)->default('Low');

            // Action Plan
            $table->text('treatment_plan')->nullable();
            $table->string('risk_owner', 150);
            $table->date('target_completion_date')->nullable();
            $table->enum('status', ['Open', 'In Progress', 'Mitigated', 'Closed'])->default('Open');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['department', 'site']);
            $table->index('inherent_level');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('risks');
        Schema::dropIfExists('findings');
        Schema::dropIfExists('audit_engagements');
    }
};
