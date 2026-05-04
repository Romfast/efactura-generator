<?php
// ============================================================================
// receiver.php — Endpoint server-side pentru:
//   1. Primire XML eFactura (POST fără action) → salvare în temp/
//   2. Proxy ANAF APIs:
//      ?action=ping     — health check (no auth)
//      ?action=validate — proxy validare ANAF (necesită anaf_token în config.json)
//      ?action=pdf      — proxy transformare ANAF (ZIP+HTML, necesită anaf_token)
//      ?action=cif      — lookup contribuabil după CIF (nu necesită token OAuth)
//   3. Curățare fișiere temporare (?cleanup=xml_XXXX.xml)
// ============================================================================

// === 1. Configurație ========================================================
$config = json_decode(file_get_contents(dirname(__FILE__) . '/config.json'), true);
if (!$config) {
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json');
    die(json_encode(['success' => false, 'error' => 'Eroare la încărcarea configurației']));
}

// === 2. Funcții helper ======================================================

/** Validează structura XML și namespace-urile UBL. */
function validateXML($xmlContent) {
    libxml_use_internal_errors(true);
    $xmlContent = preg_replace('/^\xEF\xBB\xBF/', '', $xmlContent);
    $xmlContent = trim($xmlContent);
    $xml = simplexml_load_string($xmlContent);

    if ($xml === false) {
        $errors = libxml_get_errors();
        $msgs = array_map(fn($e) => [
            'level' => $e->level, 'code' => $e->code,
            'column' => $e->column, 'message' => $e->message, 'line' => $e->line
        ], $errors);
        libxml_clear_errors();
        return ['valid' => false, 'errors' => $msgs];
    }

    $namespaces = $xml->getNamespaces(true);
    $required = [
        'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
    ];
    foreach ($required as $ns) {
        if (!in_array($ns, array_values($namespaces))) {
            return ['valid' => false, 'errors' => [['message' => "Namespace lipsă: $ns"]]];
        }
    }
    return ['valid' => true, 'errors' => []];
}

/** Verifică IP-ul clientului față de lista allowed_ips din config.json. */
function checkIP() {
    global $config;
    return in_array($_SERVER['REMOTE_ADDR'], $config['allowed_ips']);
}

/** Verifică header-ul X-Api-Key față de api_key din config.json. */
function validateToken() {
    global $config;
    $headers = getallheaders();
    $token = $headers['X-Api-Key'] ?? '';
    return hash_equals($config['api_key'], $token);
}

/**
 * Execută un request cURL POST. Returnează ['body' => string, 'error' => string].
 * @param string $url     URL destinație
 * @param string $body    Corp request
 * @param array  $headers Headere suplimentare
 */
function curlPost($url, $body, $headers = []) {
    if (!function_exists('curl_init')) {
        return ['body' => '', 'error' => 'cURL nu este disponibil pe acest server'];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $resp  = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    return ['body' => $resp ?: '', 'error' => $error];
}

// === 3. Action routing (înainte de auth pentru ?action=ping) ================
$action = $_GET['action'] ?? '';

// Health check — nu necesită auth
if ($action === 'ping') {
    header('Content-Type: application/json');
    echo json_encode(['pong' => true]);
    exit;
}

// === 4. Auth ================================================================
// Notă: IP check-ul are false || pentru backward compat — în prod, setați
// allowed_ips corect și eliminați `false ||` din această linie.
if (false || !checkIP()) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: application/json');
    error_log("Acces interzis pentru IP: " . $_SERVER['REMOTE_ADDR']);
    die(json_encode(['success' => false, 'error' => 'Acces interzis', 'details' => 'IP-ul nu este autorizat']));
}

// ANAF proxy actions: nu necesită X-Api-Key (same-origin implicat prin IP check)
// Upload XML: necesită X-Api-Key
if (!in_array($action, ['validate', 'pdf', 'cif'])) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && !validateToken()) {
        header('HTTP/1.1 401 Unauthorized');
        header('Content-Type: application/json');
        error_log("Token invalid de la IP: " . $_SERVER['REMOTE_ADDR']);
        die(json_encode(['success' => false, 'error' => 'Token invalid', 'details' => 'Autentificare eșuată']));
    }
}

// === 5. ANAF proxy handlers =================================================

/**
 * Proxy validare ANAF eFactura.
 * Necesită: "anaf_token": "Bearer XXX" în config.json
 * POST https://api.anaf.ro/prod/FCTEL/rest/validare/FACT1
 */
function handleAnafValidate() {
    global $config;
    $xmlContent = file_get_contents('php://input');
    $token = $config['anaf_token'] ?? '';

    $headers = ['Content-Type: text/plain; charset=utf-8'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }

    $result = curlPost('https://api.anaf.ro/prod/FCTEL/rest/validare/FACT1', $xmlContent, $headers);

    header('Content-Type: application/json');
    if ($result['error']) {
        http_response_code(502);
        echo json_encode(['error' => 'cURL error: ' . $result['error']]);
        exit;
    }
    // Transmite răspunsul ANAF direct — structura: {"Messages": [...]}
    echo $result['body'];
    exit;
}

/**
 * Proxy transformare ANAF (vizualizare ZIP+HTML).
 * Notă: ANAF returnează ZIP cu fișiere HTML, nu PDF direct.
 * Necesită: "anaf_token": "Bearer XXX" în config.json
 * POST https://api.anaf.ro/prod/FCTEL/rest/transformare/FACT1/DA
 */
function handleAnafPdf() {
    global $config;
    $xmlContent = file_get_contents('php://input');
    $token = $config['anaf_token'] ?? '';

    $headers = ['Content-Type: text/plain; charset=utf-8'];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }

    $result = curlPost('https://api.anaf.ro/prod/FCTEL/rest/transformare/FACT1/DA', $xmlContent, $headers);

    if ($result['error']) {
        header('Content-Type: application/json');
        http_response_code(502);
        echo json_encode(['error' => 'cURL error: ' . $result['error']]);
        exit;
    }
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="vizualizare_anaf.zip"');
    echo $result['body'];
    exit;
}

/**
 * Proxy lookup contribuabil după CIF prin ANAF.
 * Nu necesită token OAuth — API public ANAF.
 *
 * API utilizat: PlatitorTvaRest v9 (sincron)
 *   POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
 *   Body: [{"cui": <int>, "data": "YYYY-MM-DD"}]
 *   Răspuns direct: {found: [...], notFound: [...]}
 *   Doc: https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt
 *
 * Alternativă disponibilă: AsynchWebService v8 (async, batch până la 100 CUI-uri)
 *   Submit : POST https://webservicesp.anaf.ro/AsynchWebService/api/v8/ws/tva → correlationId
 *   Result : GET  https://webservicesp.anaf.ro/AsynchWebService/api/v7/ws/tva?id={correlationId}
 *            (după min. 2s; rezultat disponibil max. 3 zile)
 *   Doc: https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_Async_V8.txt
 *   Potrivit pentru bulk lookup (ex. import multiplu CIF-uri); pentru single CIF la click
 *   user, v9 sincron e preferabil (un singur request, fără polling).
 */
function handleAnafCif() {
    $cif = intval($_GET['cif'] ?? '0');
    if ($cif <= 0) {
        header('Content-Type: application/json');
        http_response_code(400);
        echo json_encode(['error' => 'CIF invalid sau lipsă']);
        exit;
    }

    $today   = date('Y-m-d');
    $payload = json_encode([['cui' => $cif, 'data' => $today]]);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];

    $result = curlPost(
        'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva',
        $payload, $headers
    );

    header('Content-Type: application/json');

    if ($result['error']) {
        http_response_code(502);
        echo json_encode(['error' => 'ANAF indisponibil: ' . $result['error']]);
        exit;
    }

    $data = json_decode($result['body'], true);
    if (!$data || !array_key_exists('found', $data)) {
        http_response_code(502);
        echo json_encode(['error' => 'Răspuns neașteptat ANAF', 'raw' => $result['body']]);
        exit;
    }

    echo json_encode(_normalizeCifResponse($data, $cif));
    exit;
}

/** Normalizează răspunsul ANAF TVA v9 în formatul js/anaf.js. */
function _normalizeCifResponse($data, $cif) {
    $found = $data['found'] ?? [];
    if (empty($found)) {
        return ['found' => false];
    }
    $c  = $found[0];
    $dg = $c['date_generale'] ?? [];
    $tv = $c['inregistrare_scop_Tva'] ?? [];
    return [
        'found'     => true,
        'denumire'  => $dg['denumire'] ?? '',
        'adresa'    => $dg['adresa']   ?? '',
        'nrRegCom'  => $dg['nrRegCom'] ?? '',
        'cui'       => $dg['cui']      ?? $cif,
        'tvaActiv'  => !empty($tv['scpTVA']),
    ];
}

// === 6. Rutare acțiuni ANAF =================================================
switch ($action) {
    case 'validate': handleAnafValidate();
    case 'pdf':      handleAnafPdf();
    case 'cif':      handleAnafCif();
}

// === 7. Upload XML (comportament original) ==================================
$uploadDir = dirname(__FILE__) . '/temp/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $xmlContent = file_get_contents('php://input');
        $validationResult = validateXML($xmlContent);

        if (!$validationResult['valid']) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'XML invalid', 'details' => $validationResult['errors']]);
            error_log("Validare XML eșuată: " . json_encode($validationResult['errors']));
            exit;
        }

        $fileName = uniqid('xml_') . '.xml';
        $filePath = $uploadDir . $fileName;
        if (file_put_contents($filePath, $xmlContent)) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'fileName' => $fileName]);
        } else {
            throw new Exception('Eroare la salvarea fișierului');
        }
    } catch (Exception $e) {
        header('Content-Type: application/json');
        http_response_code(500);
        error_log("Eroare procesare XML: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// === 8. Curățare manuală fișiere temporare (?cleanup=xml_XXXX.xml) =========
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['cleanup'])) {
    $fileName = basename($_GET['cleanup']);
    if (preg_match('/^xml_[a-f0-9]+\.xml$/', $fileName)) {
        $filePath = $uploadDir . $fileName;
        if (file_exists($filePath)) {
            if (unlink($filePath)) {
                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
            } else {
                header('Content-Type: application/json');
                http_response_code(500);
                error_log("Nu s-a putut șterge: " . $filePath);
                echo json_encode(['success' => false, 'error' => 'Nu s-a putut șterge fișierul']);
            }
        } else {
            header('Content-Type: application/json');
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Fișierul nu există']);
        }
    } else {
        header('Content-Type: application/json');
        http_response_code(400);
        error_log("Nume fișier invalid solicitat: " . $fileName);
        echo json_encode(['success' => false, 'error' => 'Nume fișier invalid']);
    }
    exit;
}

// === 9. Curățare automată fișiere vechi =====================================
$files  = glob($uploadDir . 'xml_*.xml');
$now    = time();
$maxAge = ($config['temp_file_lifetime'] ?? 1) * 3600;

foreach ($files as $file) {
    if ($now - filemtime($file) > $maxAge) {
        @unlink($file);
        error_log("Fișier vechi șters: " . basename($file));
    }
}
?>
