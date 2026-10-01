<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Finding;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class FindingController extends Controller
{
    /**
     * Mengambil daftar temuan audit (AFS) dengan filter lengkap dan statistik.
     * GET /api/v1/findings
     */
    public function index(Request $request): JsonResponse
    {
        $query = Finding::query();

        // 1. Filter Project
        if ($request->filled('project') && strtoupper($request->project) !== 'ALL') {
            $query->where('project_audit', $request->project);
        }

        // 2. Filter Site
        if ($request->filled('site') && strtoupper($request->site) !== 'ALL') {
            $query->where('site', $request->site);
        }

        // 3. Filter Status
        if ($request->filled('status') && strtoupper($request->status) !== 'ALL') {
            $query->where('status', strtoupper($request->status));
        }

        // 4. Filter Kategori (MAJOR, MINOR, IMPROVEMENT)
        if ($request->filled('kategori') && strtoupper($request->kategori) !== 'ALL') {
            $query->where('kategori', strtoupper($request->kategori));
        }

        // 5. Filter Pencarian Bebas
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('no', 'like', "%{$search}%")
                  ->orWhere('problem_finding', 'like', "%{$search}%")
                  ->orWhere('detail_temuan', 'like', "%{$search}%")
                  ->orWhere('rekomendasi', 'like', "%{$search}%")
                  ->orWhere('pic_site', 'like', "%{$search}%")
                  ->orWhere('pic_ho', 'like', "%{$search}%")
                  ->orWhere('project_audit', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->get('per_page', 25);
        $findings = $query->orderBy('id', 'desc')->paginate($perPage);

        // Perhitungan Statistik Real-Time dari SQL Server
        $totalAll = Finding::count();
        $totalClose = Finding::where('status', 'CLOSE')->count();
        $totalOpen = Finding::where('status', 'OPEN')->count();
        $totalProgress = Finding::where('status', 'IN PROGRESS')->count();
        $totalOverdue = Finding::where('remarks', 'OVERDUE')->count();

        return response()->json([
            'success' => true,
            'message' => 'Data temuan audit berhasil diambil dari database SQL Server.',
            'data' => $findings->items(),
            'meta' => [
                'current_page' => $findings->currentPage(),
                'total_items' => $findings->total(),
                'total_pages' => $findings->lastPage(),
                'per_page' => $findings->perPage(),
            ],
            'statistics' => [
                'total' => $totalAll,
                'close' => $totalClose,
                'close_pct' => $totalAll > 0 ? round(($totalClose / $totalAll) * 100, 2) : 0,
                'open' => $totalOpen,
                'open_pct' => $totalAll > 0 ? round(($totalOpen / $totalAll) * 100, 2) : 0,
                'progress' => $totalProgress,
                'progress_pct' => $totalAll > 0 ? round(($totalProgress / $totalAll) * 100, 2) : 0,
                'overdue' => $totalOverdue,
            ]
        ], 200);
    }

    /**
     * Submit / Tambah data temuan audit (AFS) baru.
     * POST /api/v1/findings
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'audit_engagement_id' => 'nullable|exists:audit_engagements,id',
            'no' => 'required|string|max:50',
            'project_audit' => 'required|string|max:150',
            'site' => 'required|string|max:50',
            'periode_audit' => 'nullable|string|max:100',
            'department' => 'nullable|string|max:100',
            'problem_finding' => 'required|string',
            'detail_temuan' => 'required|string',
            'dokumentasi_temuan' => 'nullable|string',
            'kriteria' => 'nullable|string|max:100',
            'kategori' => 'required|in:MAJOR,MINOR,IMPROVEMENT',
            'rekomendasi' => 'required|string',
            'status' => 'required|in:OPEN,CLOSE,IN PROGRESS',
            'pic_site' => 'nullable|string|max:150',
            'pic_ho' => 'nullable|string|max:150',
            'due_date' => 'nullable|date',
            'remarks' => 'nullable|string|max:50',
            'dokumentasi_closing' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi data temuan baru gagal.',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $data = $validator->validated();
            $finding = Finding::create($data);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Temuan No. {$finding->no} berhasil disimpan ke database SQL Server.",
                'data' => $finding
            ], 201);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan temuan ke database: ' . $th->getMessage()
            ], 500);
        }
    }

    /**
     * Mengambil detail satu data temuan.
     * GET /api/v1/findings/{id}
     */
    public function show(int $id): JsonResponse
    {
        $finding = Finding::find($id);

        if (!$finding) {
            return response()->json([
                'success' => false,
                'message' => 'Data temuan audit tidak ditemukan.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $finding
        ], 200);
    }

    /**
     * Update data temuan / Upload Bukti Closing.
     * PUT /api/v1/findings/{id}
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $finding = Finding::find($id);

        if (!$finding) {
            return response()->json([
                'success' => false,
                'message' => 'Data temuan audit tidak ditemukan untuk diperbarui.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'no' => 'sometimes|required|string|max:50',
            'project_audit' => 'sometimes|required|string|max:150',
            'site' => 'sometimes|required|string|max:50',
            'problem_finding' => 'sometimes|required|string',
            'detail_temuan' => 'sometimes|required|string',
            'rekomendasi' => 'sometimes|required|string',
            'kategori' => 'sometimes|in:MAJOR,MINOR,IMPROVEMENT',
            'status' => 'sometimes|in:OPEN,CLOSE,IN PROGRESS',
            'due_date' => 'nullable|date',
            'dokumentasi_closing' => 'nullable|string',
            'pic_site' => 'nullable|string',
            'pic_ho' => 'nullable|string',
            'note' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi pembaruan temuan gagal.',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $finding->update($validator->validated());
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Data temuan No. {$finding->no} berhasil diperbarui di database SQL Server.",
                'data' => $finding
            ], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui data temuan: ' . $th->getMessage()
            ], 500);
        }
    }

    /**
     * Khusus Internal Audit: Melakukan Review Closing IA (Approve / Reject).
     * POST /api/v1/findings/{id}/review-ia
     */
    public function reviewIa(Request $request, int $id): JsonResponse
    {
        $finding = Finding::find($id);

        if (!$finding) {
            return response()->json([
                'success' => false,
                'message' => 'Data temuan audit tidak ditemukan.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'review' => 'required|string|in:Approve,Reject,Correction Needed,Pending',
            'notes' => 'nullable|string',
            'reviewer_name' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $review = $request->review;
            $newStatus = ($review === 'Approve') ? 'CLOSE' : 'OPEN';
            $newRemarks = ($review === 'Approve') ? 'DONE' : ($finding->remarks === 'DONE' ? 'OVERDUE' : $finding->remarks);

            $finding->update([
                'reviewed_closing_from_ia' => $review,
                'status' => $newStatus,
                'remarks' => $newRemarks,
                'ia_review_notes' => $request->notes,
                'ia_reviewed_at' => Carbon::now(),
                'ia_reviewed_by' => $request->reviewer_name,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Review IA berhasil dicatat. Status temuan otomatis menjadi {$newStatus}.",
                'data' => $finding
            ], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses review IA: ' . $th->getMessage()
            ], 500);
        }
    }

    /**
     * Endpoint Notifikasi Real-Time khusus Internal Audit:
     * Mengambil bukti temuan yang diinput setelah tanggal tertentu (default hari ini).
     * GET /api/v1/findings/recent-evidence-notifications
     */
    public function notifications(Request $request): JsonResponse
    {
        $sinceDate = $request->get('since_date', Carbon::today()->toDateString());

        $recentEvidenceFindings = Finding::query()
            ->whereNotNull('dokumentasi_closing')
            ->where('updated_at', '>=', $sinceDate)
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $recentEvidenceFindings->count(),
            'since_date' => $sinceDate,
            'data' => $recentEvidenceFindings
        ], 200);
    }

    /**
     * Hapus temuan audit.
     * DELETE /api/v1/findings/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        $finding = Finding::find($id);

        if (!$finding) {
            return response()->json([
                'success' => false,
                'message' => 'Temuan tidak ditemukan.'
            ], 404);
        }

        $no = $finding->no;
        $finding->delete();

        return response()->json([
            'success' => true,
            'message' => "Data temuan No. {$no} berhasil dihapus dari database SQL Server."
        ], 200);
    }
}
