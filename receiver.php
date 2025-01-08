<?php
// Încărcare configurație
$config = json_decode(file_get_contents(dirname(__FILE__) . '/config.json'), true);
if (!$config) {
    header('HTTP/1.1 500 Internal Server Error');
    die('Eroare la încărcarea configurației');
}

// Funcție de validare XML
function validateXML($xmlContent) {
    // Dezactivează raportarea erorilor standard și folosește erori interne libxml
    libxml_use_internal_errors(true);
    
    // Elimină BOM (Byte Order Mark) dacă există
    $xmlContent = preg_replace('/^\xEF\xBB\xBF/', '', $xmlContent);
    
    // Curăță spațiile de la început și final
    $xmlContent = trim($xmlContent);
    
    // Încearcă să încarce XML-ul
    $xml = simplexml_load_string($xmlContent);
    
    if ($xml === false) {
        $errors = libxml_get_errors();
        $errorMessages = [];
        
        foreach ($errors as $error) {
            $errorMessages[] = [
                'level' => $error->level,
                'code' => $error->code,
                'column' => $error->column,
                'message' => $error->message,
                'line' => $error->line
            ];
        }
        
        libxml_clear_errors();
        
        return [
            'valid' => false,
            'errors' => $errorMessages
        ];
    }
    
    // Verifică namespace-urile necesare
    $namespaces = $xml->getNamespaces(true);
    $requiredNamespaces = [
        'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
    ];
    
    foreach ($requiredNamespaces as $ns) {
        $found = false;
        foreach ($namespaces as $namespace) {
            if ($namespace === $ns) {
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            return [
                'valid' => false,
                'errors' => [
                    ['message' => "Namespace lipsă: $ns"]
                ]
            ];
        }
    }
    
    return [
        'valid' => true,
        'errors' => []
    ];
}

// Verificare IP
function checkIP() {
    global $config;
    $clientIP = $_SERVER['REMOTE_ADDR'];
    return in_array($clientIP, $config['allowed_ips']);
}

// Verificare token
function validateToken() {
    global $config;
    $headers = getallheaders();
    $token = isset($headers['X-Api-Key']) ? $headers['X-Api-Key'] : '';
    return hash_equals($config['api_key'], $token);
}

// Verificare origine request
if (false or !checkIP()) {
    header('HTTP/1.1 403 Forbidden');
    error_log("Acces interzis pentru IP: " . $_SERVER['REMOTE_ADDR']);
    die(json_encode([
        'success' => false,
        'error' => 'Acces interzis',
        'details' => 'IP-ul nu este autorizat'
    ]));
}

// Verificare token
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && !validateToken()) {
    header('HTTP/1.1 401 Unauthorized');
    error_log("Token invalid de la IP: " . $_SERVER['REMOTE_ADDR']);
    die(json_encode([
        'success' => false,
        'error' => 'Token invalid',
        'details' => 'Autentificare eșuată'
    ]));
}

// Configurare director pentru fișiere temporare
$uploadDir = dirname(__FILE__) . '/temp/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

// Procesare request POST (primire XML)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Citește conținutul XML din request
        $xmlContent = file_get_contents('php://input');
        
        // Validare XML
        $validationResult = validateXML($xmlContent);
        
        if (!$validationResult['valid']) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'XML invalid',
                'details' => $validationResult['errors']
            ]);
            error_log("Validare XML eșuată: " . json_encode($validationResult['errors']));
            exit;
        }
        
        // Generează nume unic pentru fișier
        $fileName = uniqid('xml_') . '.xml';
        $filePath = $uploadDir . $fileName;
        
        // Salvează fișierul
        if (file_put_contents($filePath, $xmlContent)) {
            // Răspuns succes
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'fileName' => $fileName
            ]);
        } else {
            throw new Exception('Eroare la salvarea fișierului');
        }
    } catch (Exception $e) {
        header('Content-Type: application/json');
        http_response_code(500);
        error_log("Eroare procesare XML: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}

// Procesare request GET (curățare fișiere temporare)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['cleanup'])) {
    $fileName = basename($_GET['cleanup']); // Sanitizare nume fișier
    if (preg_match('/^xml_[a-f0-9]+\.xml$/', $fileName)) { // Verifică formatul numelui
        $filePath = $uploadDir . $fileName;
        
        if (file_exists($filePath)) {
            if (unlink($filePath)) {
                header('Content-Type: application/json');
                echo json_encode(['success' => true]);
            } else {
                header('Content-Type: application/json');
                http_response_code(500);
                error_log("Nu s-a putut șterge fișierul: " . $filePath);
                echo json_encode([
                    'success' => false,
                    'error' => 'Nu s-a putut șterge fișierul'
                ]);
            }
        } else {
            header('Content-Type: application/json');
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Fișierul nu există'
            ]);
        }
    } else {
        header('Content-Type: application/json');
        http_response_code(400);
        error_log("Nume fișier invalid solicitat: " . $fileName);
        echo json_encode([
            'success' => false,
            'error' => 'Nume fișier invalid'
        ]);
    }
}

// Curățare automată a fișierelor vechi
$files = glob($uploadDir . 'xml_*.xml');
$now = time();
$maxAge = $config['temp_file_lifetime'] * 3600; // Conversie ore în secunde

foreach ($files as $file) {
    if ($now - filemtime($file) > $maxAge) {
        @unlink($file);
        error_log("Fișier vechi șters: " . basename($file));
    }
}
?>