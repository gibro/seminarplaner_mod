<?php
// This file is part of Moodle - http://moodle.org/

// D50: Der eigene Anlegen-Bereich ist entfallen. Alte Links und Lesezeichen
// landen in der Bibliothek; Anlegen ist dort ein Button, der den Editor öffnet.

require_once(__DIR__ . '/bootstrap.php');
require_once(__DIR__ . '/locallib.php');

$id = required_param('id', PARAM_INT);
seminarplaner_require_activity_context($id, 'mod/seminarplaner:view');

redirect(new moodle_url('/mod/seminarplaner/methodlibrary.php', ['id' => $id, 'create' => 1]));
