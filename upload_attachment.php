<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/bootstrap.php');

const MOD_SEMINARPLANER_UPLOAD_MAX_BYTES = 10485760; // 10 MB.
const MOD_SEMINARPLANER_UPLOAD_BLOCKED_EXTENSIONS = [
    'php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'cgi', 'pl', 'py', 'rb',
    'sh', 'bash', 'bat', 'cmd', 'com', 'exe', 'msi', 'jsp', 'asp', 'aspx',
    'htaccess', 'shtml',
];
const MOD_SEMINARPLANER_UPLOAD_ALLOWED_H5P_EXTENSIONS = ['h5p'];

try {
    $cmid = required_param('cmid', PARAM_INT);
    $kind = optional_param('kind', 'materialien', PARAM_ALPHA);
    $draftitemid = optional_param('draftitemid', 0, PARAM_INT);

    $cm = get_coursemodule_from_id('seminarplaner', $cmid, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    require_login($course, true, $cm);
    $context = context_module::instance((int)$cm->id);
    require_capability('mod/seminarplaner:managemethods', $context);
    require_sesskey();

    if (!in_array($kind, ['materialien', 'h5p'], true)) {
        throw new moodle_exception('invalidparameter');
    }

    if (empty($_FILES['attachment']) || !is_uploaded_file($_FILES['attachment']['tmp_name'])) {
        throw new moodle_exception('invalidparameter');
    }

    $filesize = (int)($_FILES['attachment']['size'] ?? 0);
    if ($filesize <= 0 || $filesize > MOD_SEMINARPLANER_UPLOAD_MAX_BYTES) {
        throw new moodle_exception('invalidparameter');
    }

    $filename = clean_param((string)($_FILES['attachment']['name'] ?? ''), PARAM_FILE);
    if ($filename === '' || $filename === '.') {
        throw new moodle_exception('invalidparameter');
    }
    $extension = core_text::strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($extension !== '' && in_array($extension, MOD_SEMINARPLANER_UPLOAD_BLOCKED_EXTENSIONS, true)) {
        throw new moodle_exception('invalidparameter');
    }
    if ($kind === 'h5p' && !in_array($extension, MOD_SEMINARPLANER_UPLOAD_ALLOWED_H5P_EXTENSIONS, true)) {
        throw new moodle_exception('invalidparameter');
    }

    if ($draftitemid <= 0) {
        $draftitemid = file_get_unused_draft_itemid();
    }

    $userctx = context_user::instance((int)$USER->id);
    $fs = get_file_storage();
    $existing = $fs->get_file($userctx->id, 'user', 'draft', $draftitemid, '/', $filename);
    if ($existing) {
        $existing->delete();
    }

    $filerecord = (object)[
        'contextid' => $userctx->id,
        'component' => 'user',
        'filearea' => 'draft',
        'itemid' => $draftitemid,
        'filepath' => '/',
        'filename' => $filename,
        'userid' => (int)$USER->id,
    ];
    $fs->create_file_from_pathname($filerecord, (string)$_FILES['attachment']['tmp_name']);

    $files = $fs->get_area_files($userctx->id, 'user', 'draft', $draftitemid, 'filename', false);
    $out = [];
    foreach ($files as $file) {
        if ($file->is_directory()) {
            continue;
        }
        $out[] = [
            'name' => (string)$file->get_filename(),
            'mimetype' => (string)$file->get_mimetype(),
            'size' => (int)$file->get_filesize(),
        ];
    }

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'draftitemid' => $draftitemid,
        'files' => $out,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
} catch (Throwable $e) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    debugging('mod_seminarplaner upload_attachment failed: ' . $e->getMessage(), DEBUG_DEVELOPER);
    echo json_encode([
        'success' => false,
        'message' => 'Upload fehlgeschlagen.',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
