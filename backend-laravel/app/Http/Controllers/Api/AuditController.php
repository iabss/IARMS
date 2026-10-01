<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditEngagement;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AuditController extends Controller
{
    /**
     * Mengambil seluruh data proyek audit / engagements beserta statistiknya.
     * GET /api/v1/audits
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditEngagement::query()->withCount('findings');

        if ($request->filled('site') && strtoupper($request->site) !== 'ALL') {
            $query->where('site', $request->site);
        }

        if ($request->filled('status') && strtoupper($request->status) !== 'ALL') {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('audit_code', 'like', "%{$search}%")
                  ->orWhere('lead_auditor', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        $audits = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'message' => 'Data audit engagement berhasil diambil.',
            'data' => $audits->items(),
            'meta' => [
                'current_page' => $audits->currentPage(),
                'total_items' => $audits->total(),
                'total_pages' => $audits->lastPage(),
                'per_page' => $audits->perPage(),
            ],
            'statistics' => [
                'total_audits' => AuditEngagement::count(),
                'completed' => AuditEngagement::where('status', 'Completed')->count(),
                'ongoing' => AuditEngagement::where('status', 'On-Going')->count(),
                'overdue' => AuditEngagement::where('status', 'Overdue')->count(),
            ]
        ], 200);
    }

    /**
     * Submit / Buat data penugasan audit baru.
     * POST /api/v1/audits
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'audit_code' => 'required|string|max:50|unique:audit_engagements,audit_code',
            'title' => 'required|string|max:255',
            'department' => 'nullable|string|max:100',
            'site' => 'required|string|max:50',
            'lead_auditor' => 'required|string|max:100',
            'audit_team' => 'nullable|string',
            'plan_days' => 'nullable|integer|min:0',
            'act_days' => 'nullable|integer|min:0',
            'progress' => 'nullable|numeric|min:0|max:100',
            'status' => 'required|string|in:Planned,On-Going,Completed,Overdue',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'scope_description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi data audit gagal.',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $audit = AuditEngagement::create($validator->validated());
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Proyek audit baru berhasil didaftarkan.',
                'data' => $audit
            ], 201);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan penugasan audit ke SQL Server: ' . $th->getMessage(),
            ], 500);
        }
    }

    /**
     * Detail satu proyek audit beserta temuan & risikonya.
     * GET /api/v1/audits/{id}
     */
    public function show(int $id): JsonResponse
    {
        $audit = AuditEngagement::with(['findings', 'risks'])->find($id);

        if (!$audit) {
            return response()->json([
                'success' => false,
                'message' => 'Data audit engagement tidak ditemukan.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $audit
        ], 200);
    }
}
