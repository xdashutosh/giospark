<?php
/**
 * GIO Spark — form handler for the Enquiry and Contact pages.
 * Emails each submission to the address below and replies with JSON.
 * Works on standard PHP hosting (cPanel, Hostinger, GoDaddy…) where mail() is enabled.
 */

$TO        = 'info@giospark.com';
$FROM      = 'no-reply@giospark.com';   // use an address on your own domain for better delivery
$SITE_NAME = 'GIO Spark Website';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply($ok, $code = 200, $error = null) {
    http_response_code($code);
    echo json_encode($error ? ['ok' => $ok, 'error' => $error] : ['ok' => $ok]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(false, 405, 'method');
}

// The site posts JSON; fall back to normal form fields if that's what arrives.
$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) {
    $in = $_POST;
}

// honeypot: real visitors never fill this hidden field
if (!empty($in['company_website'])) {
    reply(true);
}

function clean($value, $max = 2000) {
    if (is_array($value)) {
        $value = implode(', ', array_map('strval', $value));
    }
    $value = trim(strip_tags((string) $value));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $max);
}

$name  = clean($in['name'] ?? '', 120);
$phone = preg_replace('/\D+/', '', (string) ($in['phone'] ?? ''));
if (strlen($phone) === 12 && strpos($phone, '91') === 0) $phone = substr($phone, 2);
if (strlen($phone) === 11 && $phone[0] === '0') $phone = substr($phone, 1);

if ($name === '' || !preg_match('/^[6-9]\d{9}$/', $phone)) {
    reply(false, 422, 'invalid');
}

$email = filter_var(trim((string) ($in['email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: '';
$form  = (($in['form'] ?? '') === 'contact') ? 'Contact message' : 'New enquiry';

$labels = [
    'type'                    => 'Enquiry type',
    'pet_use'                 => 'Bottles for',
    'pet_quantity'            => 'Bottles needed',
    'territory'               => 'Territory',
    'distribution_experience' => 'Distribution experience',
    'storage'                 => 'Storage space',
    'sizes'                   => 'Bottle sizes',
    'requirement'             => 'Requirement',
    'quantity'                => 'Quantity',
    'city'                    => 'City',
    'required_by'             => 'Required by',
    'name'                    => 'Name',
    'business'                => 'Business',
    'phone'                   => 'Phone',
    'email'                   => 'Email',
    'state'                   => 'State',
    'preferred_contact'       => 'Preferred contact',
    'subject'                 => 'Subject',
    'message'                 => 'Message',
];

$lines = [];
foreach ($labels as $key => $label) {
    if (!isset($in[$key])) continue;
    $value = $key === 'phone' ? '+91 ' . $phone : clean($in[$key]);
    if ($value === '') continue;
    $lines[] = str_pad($label . ':', 26) . $value;
}

$body  = $form . " from the GIO Spark website\n";
$body .= str_repeat('-', 48) . "\n\n";
$body .= implode("\n", $lines) . "\n\n";
$body .= str_repeat('-', 48) . "\n";
$body .= 'Sent ' . date('d M Y, H:i') . ' · IP ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";

$subjectLine = $form . ' — ' . preg_replace('/[\r\n]+/', ' ', $name);
$subject = '=?UTF-8?B?' . base64_encode($subjectLine) . '?=';

$headers   = [];
$headers[] = 'From: ' . $SITE_NAME . ' <' . $FROM . '>';
if ($email) $headers[] = 'Reply-To: ' . $email;
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'Content-Transfer-Encoding: 8bit';

$sent = @mail($TO, $subject, $body, implode("\r\n", $headers));
reply((bool) $sent, $sent ? 200 : 500, $sent ? null : 'mail');
