<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Risk;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RiskController extends Controller
{
    /**
     * Mengambil seluruh daftar Risk Register dan data Heatmap Matriks Risiko.
     * GET /api/v1/risks
     */
    public function index(Request $request): JsonResponse
    {
        $query = Risk::query();

        if ($request->filled('department') && strtoupper($request->department) !== 'ALL') {
            $query->where('department', $request->department);
        }

        if ($request->filled('site') && strtoupper($request->site) !== 'ALL') {
            $query->where('site', $request->site);
        }

        if ($request->filled('inherent_level') && strtoupper($request->inherent_level) !== 'ALL') {
            $query->where('inherent_level', $request->inherent_level);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('risk_id', 'like', "%{$search}%")
                  ->orWhere('risk_event', 'like', "%{$search}%")
                  ->orWhere('root_cause', 'like', "%{$search}%")
                  ->orWhere('risk_owner', 'like', "%{$search}%")
                  ->orWhere('risk_category', 'like', "%{$search}%");
            });
        }

        $risks = $query->orderBy('inherent_score', 'desc')->paginate($request->get('per_page', 20));

        // Statistik Matriks Risiko untuk Heatmap
        $heatmapData = [
            'extreme' => Risk::where('inherent_level', 'Extreme')->count(),
            'high' => Risk::where('inherent_level', 'High')->count(),
            'medium' => Risk::where('inherent_level', 'Medium')->count(),
            'low' => Risk::where('inherent_level', 'Low')->count(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Data Risk Register berhasil diambil dari database SQL Server.',
            'data' => $risks->items(),
            'meta' => [
                'current_page' => $risks->currentPage(),
                'total_items' => $risks->total(),
                'total_pages' => $risks->lastPage(),
                'per_page' => $risks->perPage(),
            ],
            'heatmap' => $heatmapData
        ], 200);
    }

    /**
     * Submit / Tambah data risiko baru.
     * POST /api/v1/risks
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'risk_id' => 'required|string|max:50|unique:risks,risk_id',
            'audit_engagement_id' => 'nullable|exists:audit_engagements,id',
            'department' => 'required|string|max:100',
            'site' => 'required|string|max:50',
            'risk_category' => 'required|string|max:100',
            'risk_event' => 'required|string',
            'root_cause' => 'nullable|string',
            'risk_impact' => 'nullable|string',
            'likelihood' => 'required|integer|min:1|max:5',
            'impact' => 'required|integer|min:1|max:5',
            'existing_controls' => 'nullable|string',
            'control_effectiveness' => 'required|in:Effective,Partially Effective,Ineffective',
            'residual_likelihood' => 'nullable|integer|min:1|max:5',
            'residual_impact' => 'nullable|integer|min:1|max:5',
            'treatment_plan' => 'nullable|string',
            'risk_owner' => 'required|string|max:150',
            'target_completion_date' => 'nullable|date',
            'status' => 'required|in:Open,In Progress,Mitigated,Closed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi data risiko gagal.',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $risk = Risk::create($validator->validated());
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Risiko {$risk->risk_id} berhasil didaftarkan ke database SQL Server.",
                'data' => $risk
            ], 201);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan data risiko: ' . $th->getMessage()
            ], 500);
        }
    }

    /**
     * Detail satu data risiko.
     * GET /api/v1/risks/{id}
     */
    public function show(int $id): JsonResponse
    {
        $risk = Risk::find($id);

        if (!$risk) {
            return response()->json([
                'success' => false,
                'message' => 'Data risiko tidak ditemukan.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $risk
        ], 200);
    }

    /**
     * Update data risiko / Rencana Mitigasi.
     * PUT /api/v1/risks/{id}
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $risk = Risk::find($id);

        if (!$risk) {
            return response()->json([
                'success' => false,
                'message' => 'Data risiko tidak ditemukan.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'department' => 'sometimes|required|string|max:100',
            'site' => 'sometimes|required|string|max:50',
            'risk_event' => 'sometimes|required|string',
            'likelihood' => 'sometimes|required|integer|min:1|max:5',
            'impact' => 'sometimes|required|integer|min:1|max:5',
            'control_effectiveness' => 'sometimes|in:Effective,Partially Effective,Ineffective',
            'residual_likelihood' => 'nullable|integer|min:1|max:5',
            'residual_impact' => 'nullable|integer|min:1|max:5',
            'treatment_plan' => 'nullable|string',
            'status' => 'sometimes|in:Open,In Progress,Mitigated,Closed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $risk->update($validator->validated());
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Data risiko {$risk->risk_id} berhasil diperbarui di SQL Server.",
                'data' => $risk
            ], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui risiko: ' . $th->getMessage()
            ], 500);
        }
    }

    /**
     * Hapus data risiko.
     * DELETE /api/v1/risks/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        $risk = Risk::find($id);

        if (!$risk) {
            return response()->json([
                'success' => false,
                'message' => 'Data risiko tidak ditemukan.'
            ], 404);
        }

        $riskId = $risk->risk_id;
        $risk->delete();

        return response()->json([
            'success' => true,
            'message' => "Data risiko {$riskId} berhasil dihapus dari SQL Server."
        ], 200);
    }
}
