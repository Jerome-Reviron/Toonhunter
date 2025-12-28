<?php
require_once __DIR__ . "/cors.php";
require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;

$mail = new PHPMailer(true);

echo "PHPMailer chargé avec succès !";
