package com.deepanswerlabs.awsarchitect;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Iterator;

/**
 * On-device SQLite store for course progress.
 *
 * The web app hands over its whole progress object (the same JSON it keeps in
 * localStorage). We keep that snapshot as the source of truth for loading, and
 * also explode it into plain tables so the database is readable on its own:
 * lessons_done, quiz_best, quiz_attempts, exam_attempts, flashcards, notes,
 * quick_checks.
 */
@CapacitorPlugin(name = "ProgressStore")
public class ProgressStorePlugin extends Plugin {

    static final String DB_NAME = "progress.db";
    static final int DB_VERSION = 1;

    private Db db;

    @Override
    public void load() {
        db = new Db(getContext());
    }

    @PluginMethod
    public void loadState(PluginCall call) {
        String course = call.getString("course");
        if (course == null) { call.reject("course is required"); return; }
        JSObject ret = new JSObject();
        try (Cursor c = db.getReadableDatabase().rawQuery(
                "SELECT json, saved_at FROM progress_state WHERE course_id = ?", new String[]{course})) {
            if (c.moveToFirst()) {
                ret.put("json", c.getString(0));
                ret.put("savedAt", c.getLong(1));
            }
        } catch (Exception e) {
            call.reject("load failed: " + e.getMessage(), e);
            return;
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void saveState(PluginCall call) {
        String course = call.getString("course");
        String json = call.getString("json");
        if (course == null || json == null) { call.reject("course and json are required"); return; }
        SQLiteDatabase w = db.getWritableDatabase();
        w.beginTransaction();
        try {
            JSONObject s = new JSONObject(json);
            long savedAt = s.optLong("savedAt", System.currentTimeMillis());

            ContentValues st = new ContentValues();
            st.put("course_id", course);
            st.put("json", json);
            st.put("saved_at", savedAt);
            w.insertWithOnConflict("progress_state", null, st, SQLiteDatabase.CONFLICT_REPLACE);

            String[] arg = new String[]{course};
            for (String t : new String[]{"lessons_done", "quiz_best", "quiz_attempts", "exam_attempts", "flashcards", "notes", "quick_checks"}) {
                w.delete(t, "course_id = ?", arg);
            }

            JSONObject lessons = s.optJSONObject("lessons");
            if (lessons != null) for (Iterator<String> it = lessons.keys(); it.hasNext(); ) {
                String k = it.next();
                ContentValues v = new ContentValues();
                v.put("course_id", course);
                v.put("lesson_key", k);
                v.put("completed_at", lessons.optLong(k));
                w.insert("lessons_done", null, v);
            }

            JSONObject best = s.optJSONObject("quizBest");
            if (best != null) for (Iterator<String> it = best.keys(); it.hasNext(); ) {
                String k = it.next();
                ContentValues v = new ContentValues();
                v.put("course_id", course);
                v.put("module_id", k);
                v.put("best_pct", best.optInt(k));
                w.insert("quiz_best", null, v);
            }

            JSONObject attempts = s.optJSONObject("quizAttempts");
            if (attempts != null) for (Iterator<String> it = attempts.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONArray arr = attempts.optJSONArray(k);
                if (arr == null) continue;
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject a = arr.optJSONObject(i);
                    if (a == null) continue;
                    ContentValues v = new ContentValues();
                    v.put("course_id", course);
                    v.put("module_id", k);
                    v.put("taken_at", a.optString("date"));
                    v.put("pct", a.optInt("pct"));
                    w.insert("quiz_attempts", null, v);
                }
            }

            JSONArray exams = s.optJSONArray("examAttempts");
            if (exams != null) for (int i = 0; i < exams.length(); i++) {
                JSONObject a = exams.optJSONObject(i);
                if (a == null) continue;
                ContentValues v = new ContentValues();
                v.put("course_id", course);
                v.put("exam_id", a.optString("examId"));
                v.put("taken_at", a.optString("date"));
                v.put("pct", a.optInt("pct"));
                v.put("duration_sec", a.optInt("durationSec"));
                JSONObject d = a.optJSONObject("domains");
                v.put("domains_json", d == null ? null : d.toString());
                w.insert("exam_attempts", null, v);
            }

            JSONObject flash = s.optJSONObject("flash");
            if (flash != null) for (Iterator<String> it = flash.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONObject f = flash.optJSONObject(k);
                if (f == null) continue;
                ContentValues v = new ContentValues();
                v.put("course_id", course);
                v.put("card_key", k);
                v.put("box", f.optInt("box", 1));
                v.put("due_at", f.optLong("due"));
                w.insert("flashcards", null, v);
            }

            JSONArray notes = s.optJSONArray("notes");
            if (notes != null) for (int i = 0; i < notes.length(); i++) {
                JSONObject n = notes.optJSONObject(i);
                if (n == null) continue;
                ContentValues v = new ContentValues();
                v.put("course_id", course);
                v.put("note_id", n.optString("id"));
                v.put("text", n.optString("text"));
                v.put("context", n.optString("ctx"));
                v.put("href", n.optString("href"));
                v.put("created_at", n.optLong("createdAt"));
                v.put("learned", n.optBoolean("learned") ? 1 : 0);
                w.insertWithOnConflict("notes", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }

            JSONObject checks = s.optJSONObject("checks");
            if (checks != null) for (Iterator<String> it = checks.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONObject q = checks.optJSONObject(k);
                if (q == null) continue;
                for (Iterator<String> qi = q.keys(); qi.hasNext(); ) {
                    String idx = qi.next();
                    ContentValues v = new ContentValues();
                    v.put("course_id", course);
                    v.put("lesson_key", k);
                    v.put("question_idx", Integer.parseInt(idx));
                    v.put("picked", q.optInt(idx));
                    w.insert("quick_checks", null, v);
                }
            }

            w.setTransactionSuccessful();
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage(), e);
            return;
        } finally {
            w.endTransaction();
        }
        call.resolve();
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        File f = getContext().getDatabasePath(DB_NAME);
        ret.put("path", f.getAbsolutePath());
        ret.put("sizeBytes", f.length());
        JSObject counts = new JSObject();
        SQLiteDatabase r = db.getReadableDatabase();
        for (String t : new String[]{"lessons_done", "quiz_best", "quiz_attempts", "exam_attempts", "flashcards", "notes", "quick_checks"}) {
            try (Cursor c = r.rawQuery("SELECT COUNT(*) FROM " + t, null)) {
                counts.put(t, c.moveToFirst() ? c.getLong(0) : 0);
            }
        }
        ret.put("counts", counts);
        call.resolve(ret);
    }

    /** Copy the database to the cache dir and open the Android share sheet for it. */
    @PluginMethod
    public void exportDb(PluginCall call) {
        try {
            SQLiteDatabase w = db.getWritableDatabase();
            try (Cursor c = w.rawQuery("PRAGMA wal_checkpoint(FULL)", null)) { c.moveToFirst(); }
            File src = getContext().getDatabasePath(DB_NAME);
            File out = new File(getContext().getCacheDir(), "aws-architect-progress.db");
            try (InputStream in = new FileInputStream(src); OutputStream os = new FileOutputStream(out)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/vnd.sqlite3");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, "AWS Architect progress database");
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Export progress database");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("export failed: " + e.getMessage(), e);
        }
    }

    static class Db extends SQLiteOpenHelper {
        Db(Context ctx) { super(ctx, DB_NAME, null, DB_VERSION); }

        @Override
        public void onCreate(SQLiteDatabase d) {
            d.execSQL("CREATE TABLE progress_state (course_id TEXT PRIMARY KEY, json TEXT NOT NULL, saved_at INTEGER NOT NULL)");
            d.execSQL("CREATE TABLE lessons_done (course_id TEXT NOT NULL, lesson_key TEXT NOT NULL, completed_at INTEGER, PRIMARY KEY (course_id, lesson_key))");
            d.execSQL("CREATE TABLE quiz_best (course_id TEXT NOT NULL, module_id TEXT NOT NULL, best_pct INTEGER, PRIMARY KEY (course_id, module_id))");
            d.execSQL("CREATE TABLE quiz_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT NOT NULL, module_id TEXT NOT NULL, taken_at TEXT, pct INTEGER)");
            d.execSQL("CREATE TABLE exam_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id TEXT NOT NULL, exam_id TEXT NOT NULL, taken_at TEXT, pct INTEGER, duration_sec INTEGER, domains_json TEXT)");
            d.execSQL("CREATE TABLE flashcards (course_id TEXT NOT NULL, card_key TEXT NOT NULL, box INTEGER, due_at INTEGER, PRIMARY KEY (course_id, card_key))");
            d.execSQL("CREATE TABLE notes (course_id TEXT NOT NULL, note_id TEXT NOT NULL, text TEXT, context TEXT, href TEXT, created_at INTEGER, learned INTEGER, PRIMARY KEY (course_id, note_id))");
            d.execSQL("CREATE TABLE quick_checks (course_id TEXT NOT NULL, lesson_key TEXT NOT NULL, question_idx INTEGER NOT NULL, picked INTEGER, PRIMARY KEY (course_id, lesson_key, question_idx))");
        }

        @Override
        public void onUpgrade(SQLiteDatabase d, int oldV, int newV) { /* v1 only */ }
    }
}
