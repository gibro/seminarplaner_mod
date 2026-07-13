<?php
// This file is part of Moodle - http://moodle.org/

// D16/D46: Der eigene „Bausteine"-Planungsmodus ist entfallen – Bausteine
// werden jetzt direkt in der Sequenzansicht geplant. Alte Links und
// Lesezeichen (u. a. der Überblick verlinkt noch hierher) landen daher
// stillgelegt in der Sequenz. Die Datenmigration alter Pläne bleibt davon
// unberührt (sie läuft über die Upgrade-Schritte und den Grid→Sequenz-
// Konverter, nicht über diese Seite).

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');

redirect(new moodle_url('/mod/seminarplaner/sequenz.php', ['id' => $id]));
