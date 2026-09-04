"""
TestiFy Security - Static Analysis Rule Engine
Real pattern-based detection rules across languages, mapped to CWE/OWASP.
This is a genuine (if intentionally scoped) SAST rule set: every rule is a
compiled regex or AST predicate that runs against real source text - there
are no randomized or fabricated results anywhere in this module.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class Rule:
    id: str
    title: str
    category: str          # OWASP category key, e.g. "A03:2021-Injection"
    cwe: str
    severity: str           # critical|high|medium|low
    languages: list[str]
    pattern: re.Pattern
    description: str
    recommendation: str
    negative_pattern: Optional[re.Pattern] = None  # if matches nearby, suppress (reduces false positives)
    confidence: str = "high"


def _re(p: str, flags=re.IGNORECASE) -> re.Pattern:
    return re.compile(p, flags)


LANG_EXT = {
    "python": [".py"],
    "javascript": [".js", ".jsx", ".mjs", ".cjs"],
    "typescript": [".ts", ".tsx"],
    "java": [".java"],
    "php": [".php"],
    "go": [".go"],
    "ruby": [".rb"],
    "csharp": [".cs"],
    "c": [".c", ".h"],
    "cpp": [".cpp", ".cc", ".hpp"],
    "generic": [],
}

EXT_TO_LANG = {}
for lang, exts in LANG_EXT.items():
    for e in exts:
        EXT_TO_LANG[e] = lang


RULES: list[Rule] = [
    # ---------------- SQL INJECTION (CWE-89, A03:2021) ----------------
    Rule("SQLI-PY-001", "SQL query built via string concatenation/formatting", "A03:2021-Injection", "CWE-89",
         "critical", ["python"],
         _re(r"""(?:execute|executemany|raw)\s*\(\s*(?:f['"]|['"].*?['"]\s*(?:\+|%)|['"].*?\{.*?\}.*?['"])"""),
         "User-controllable data appears to be concatenated or f-string-interpolated directly into a SQL query "
         "string passed to a DB-API execute() call, bypassing parameterization.",
         "Use parameterized queries: cursor.execute('SELECT * FROM t WHERE id=%s', (id,)) instead of building "
         "the query with f-strings/concatenation. For ORMs, use the query builder's bound-parameter API."),
    Rule("SQLI-PY-002", "SQL keyword built via f-string/format interpolation", "A03:2021-Injection", "CWE-89",
         "critical", ["python"],
         _re(r"""f['"](?:\s*)(?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]*\{[^}]+\}[^'"]*['"]"""),
         "A SQL statement is built with an f-string containing an interpolated expression, allowing "
         "attacker-controlled data to alter query structure if the interpolated value is not trusted.",
         "Build the query with a parameter placeholder (%s / :name) and pass values separately to "
         "execute(), rather than interpolating them into the query text."),
    Rule("SQLI-JS-001", "SQL query built via template literal / concatenation", "A03:2021-Injection", "CWE-89",
         "critical", ["javascript", "typescript"],
         _re(r"""\.(?:query|execute)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)"""),
         "A database query is built using template-literal interpolation or string concatenation, which allows "
         "attacker-controlled input to alter query structure.",
         "Use parameterized/prepared statements (e.g. `db.query('... WHERE id = ?', [id])`) or a query builder "
         "with bound parameters (Knex, Prisma, TypeORM)."),
    Rule("SQLI-JAVA-001", "JDBC Statement built from concatenated string", "A03:2021-Injection", "CWE-89",
         "critical", ["java"],
         _re(r"""(?:createStatement\(\)|Statement\s+\w+\s*=).{0,200}?\.execute\w*\s*\(\s*["'].*?\+"""),
         "A java.sql.Statement is executed with a query string built via concatenation.",
         "Use PreparedStatement with bound parameters (`?`) instead of Statement with concatenated SQL."),
    Rule("SQLI-PHP-001", "SQL query concatenated with request input", "A03:2021-Injection", "CWE-89",
         "critical", ["php"],
         _re(r"""(?:mysqli?_query|->query|->exec)\s*\([^)]*\$_(GET|POST|REQUEST|COOKIE)"""),
         "Superglobal user input ($_GET/$_POST/etc.) flows directly into a SQL query function.",
         "Use mysqli/PDO prepared statements with bound parameters instead of interpolating superglobals."),

    # ---------------- XSS (CWE-79, A03:2021) ----------------
    Rule("XSS-JS-001", "Unsanitized assignment to innerHTML/outerHTML", "A03:2021-Injection", "CWE-79",
         "high", ["javascript", "typescript"],
         _re(r"""\.(?:innerHTML|outerHTML)\s*=\s*(?!['"`]\s*['"`])"""),
         "Dynamic content is assigned directly to innerHTML/outerHTML, which can execute injected markup/script "
         "if the value is influenced by user input.",
         "Use textContent for plain text, or sanitize HTML with DOMPurify before assignment. Prefer framework-"
         "level templating (React/Vue) which auto-escapes by default."),
    Rule("XSS-REACT-001", "dangerouslySetInnerHTML without sanitization", "A03:2021-Injection", "CWE-79",
         "high", ["javascript", "typescript"],
         _re(r"""dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*(?!DOMPurify)"""),
         "dangerouslySetInnerHTML is used with a value that is not passed through a sanitizer such as DOMPurify.",
         "Sanitize the HTML with DOMPurify.sanitize(value) before passing it to dangerouslySetInnerHTML, or avoid "
         "raw HTML injection entirely."),
    Rule("XSS-PY-FLASK-001", "Flask response rendered with autoescape disabled / markup", "A03:2021-Injection",
         "CWE-79", "high", ["python"],
         _re(r"""Markup\s*\(\s*.*?(?:request\.|f['"]).*?\)|render_template_string\s*\(\s*(?:f['"]|.*?\+)"""),
         "Untrusted request data is wrapped in Markup() (bypasses autoescaping) or interpolated into a Jinja "
         "template string, enabling server-side XSS.",
         "Never wrap untrusted input in Markup(). Pass variables to render_template() and let Jinja's autoescaping "
         "handle output encoding."),
    Rule("XSS-PHP-001", "Unescaped echo of request input", "A03:2021-Injection", "CWE-79",
         "high", ["php"],
         _re(r"""echo\s+\$_(GET|POST|REQUEST|COOKIE)\b"""),
         "Request input is echoed directly into the HTML response without encoding.",
         "Encode output with htmlspecialchars($input, ENT_QUOTES, 'UTF-8') before echoing user-controlled data."),

    # ---------------- SSRF (CWE-918, A10:2021) ----------------
    Rule("SSRF-PY-001", "HTTP request URL derived from user input", "A10:2021-SSRF", "CWE-918",
         "high", ["python"],
         _re(r"""requests\.(?:get|post|put|delete|head)\s*\(\s*(?:url\s*=\s*)?(?:request\.|f['"].*?\{)"""),
         "An outbound HTTP request's target URL appears to be derived from request-controlled data without "
         "an allow-list check, which can enable Server-Side Request Forgery.",
         "Validate the target host against an allow-list, resolve and check the IP is not link-local/internal "
         "(e.g. 169.254.169.254, RFC1918), and disable redirects to untrusted hosts."),
    Rule("SSRF-JS-001", "fetch/axios URL built from request input", "A10:2021-SSRF", "CWE-918",
         "high", ["javascript", "typescript"],
         _re(r"""(?:fetch|axios(?:\.get|\.post)?)\s*\(\s*(?:req\.(?:query|body|params)|`[^`]*\$\{req\.)"""),
         "An outbound request URL is built directly from request query/body/params, a classic SSRF vector.",
         "Validate against an allow-list of permitted hosts/schemes before making the outbound request; never "
         "pass raw user input as the fetch target."),

    # ---------------- XXE (CWE-611, A05:2021) ----------------
    Rule("XXE-JAVA-001", "XML parser without external entity resolution disabled", "A05:2021-Security-Misconfiguration",
         "CWE-611", "high", ["java"],
         _re(r"""DocumentBuilderFactory\.newInstance\(\)(?!.{0,300}setFeature\(\s*["']http://apache\.org/xml/features/disallow-doctype-decl["']\s*,\s*true\s*\))"""),
         "A DocumentBuilderFactory is created without explicitly disabling DTD/external entity resolution, "
         "leaving the parser vulnerable to XXE.",
         "Call factory.setFeature(\"http://apache.org/xml/features/disallow-doctype-decl\", true) (or use "
         "XMLConstants.FEATURE_SECURE_PROCESSING) immediately after instantiating the factory.", confidence="medium"),
    Rule("XXE-PY-001", "lxml/xml parser with resolve_entities enabled", "A05:2021-Security-Misconfiguration",
         "CWE-611", "high", ["python"],
         _re(r"""etree\.XMLParser\s*\([^)]*resolve_entities\s*=\s*True"""),
         "An lxml XMLParser is explicitly configured with resolve_entities=True, enabling XXE.",
         "Set resolve_entities=False (the safe default) and avoid enabling DTD loading for untrusted XML."),

    # ---------------- COMMAND INJECTION (CWE-78, A03:2021) ----------------
    Rule("CMDI-PY-001", "Shell command built with untrusted input and shell=True", "A03:2021-Injection", "CWE-78",
         "critical", ["python"],
         _re(r"""subprocess\.(?:call|run|Popen|check_output)\s*\([^)]*shell\s*=\s*True"""),
         "subprocess is invoked with shell=True; if any part of the command string is influenced by external "
         "input this allows arbitrary shell command injection.",
         "Avoid shell=True. Pass the command as a list (e.g. ['ls', user_dir]) so arguments aren't interpreted "
         "by a shell, and validate/allow-list any user-supplied arguments."),
    Rule("CMDI-JS-001", "child_process exec with interpolated input", "A03:2021-Injection", "CWE-78",
         "critical", ["javascript", "typescript"],
         _re(r"""(?:child_process\.)?exec\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)"""),
         "child_process.exec is called with a command string built via interpolation/concatenation, enabling "
         "OS command injection if any part is user-controlled.",
         "Use execFile()/spawn() with an argument array instead of exec() with a concatenated string, which "
         "avoids invoking a shell entirely."),
    Rule("CMDI-PHP-001", "shell_exec/system called with request input", "A03:2021-Injection", "CWE-78",
         "critical", ["php"],
         _re(r"""(?:shell_exec|system|exec|passthru)\s*\([^)]*\$_(GET|POST|REQUEST)"""),
         "A shell execution function is called with superglobal request input.",
         "Avoid shelling out with user input. If unavoidable, use escapeshellarg() on every argument and "
         "validate against a strict allow-list."),

    # ---------------- PATH TRAVERSAL (CWE-22, A01:2021) ----------------
    Rule("PATH-PY-001", "File path built from request input without normalization check",
         "A01:2021-Broken-Access-Control", "CWE-22", "high", ["python"],
         _re(r"""open\s*\(\s*(?:os\.path\.join\s*\([^)]*request\.|f['"].*?\{.*?request\.)"""),
         "A file path passed to open() incorporates request-controlled data without verifying the resolved "
         "path stays within an intended base directory, allowing '../' traversal.",
         "Resolve the path with os.path.realpath() and verify it is a descendant of the intended base directory "
         "before opening; reject any path containing '..' segments."),
    Rule("PATH-JS-001", "fs read/write path built from request input", "A01:2021-Broken-Access-Control", "CWE-22",
         "high", ["javascript", "typescript"],
         _re(r"""fs\.(?:readFile|writeFile|createReadStream|unlink)\w*\s*\(\s*(?:path\.join\s*\([^)]*req\.|`[^`]*\$\{req\.)"""),
         "A filesystem path is constructed from request data without validating it stays within an allowed "
         "directory.",
         "Use path.normalize()/path.resolve() and verify the result is within the allowed base directory before "
         "any filesystem operation."),

    # ---------------- CSRF (CWE-352, A01:2021) ----------------
    Rule("CSRF-JS-EXPRESS-001", "State-changing route without CSRF protection middleware", "A01:2021-Broken-Access-Control",
         "CWE-352", "medium", ["javascript", "typescript"],
         _re(r"""app\.(?:post|put|delete|patch)\s*\(\s*['"]"""),
         "A state-changing Express route (POST/PUT/DELETE/PATCH) was found; verify CSRF protection (e.g. "
         "csurf middleware / SameSite cookies) is applied at the app level.",
         "Apply CSRF middleware (e.g. `csurf`) to state-changing routes, or use SameSite=Strict/Lax cookies "
         "plus double-submit tokens for API-only backends.", confidence="low"),
    Rule("CSRF-DJANGO-001", "csrf_exempt decorator on a state-changing view", "A01:2021-Broken-Access-Control",
         "CWE-352", "high", ["python"],
         _re(r"""@csrf_exempt"""),
         "A Django view is explicitly marked @csrf_exempt, disabling CSRF protection for that endpoint.",
         "Remove @csrf_exempt unless the endpoint is a verified webhook with an alternative authentication "
         "mechanism (e.g. signature verification)."),

    # ---------------- HARDCODED KEYS handled by secrets engine (see secrets_detect) ----------------

    # ---------------- JWT ISSUES (CWE-347) ----------------
    Rule("JWT-JS-001", "JWT verified with algorithm 'none' or without algorithm allow-list", "A02:2021-Cryptographic-Failures",
         "CWE-347", "high", ["javascript", "typescript"],
         _re(r"""jwt\.verify\s*\([^)]*algorithms\s*:\s*\[\s*['"]none['"]"""),
         "JWT verification explicitly allows the 'none' algorithm, letting an attacker forge unsigned tokens "
         "that are accepted as valid.",
         "Never include 'none' in the allowed algorithms list; pin verification to a single expected algorithm "
         "(e.g. ['RS256'])."),
    Rule("JWT-PY-001", "jwt.decode called with verify_signature disabled", "A02:2021-Cryptographic-Failures",
         "CWE-347", "high", ["python"],
         _re(r"""jwt\.decode\s*\([^)]*verify\s*=\s*False|options\s*=\s*\{[^}]*['"]verify_signature['"]\s*:\s*False"""),
         "JWT signature verification is explicitly disabled, allowing forged tokens to be accepted.",
         "Always verify the signature (verify=True / omit the override) and pin the expected algorithm(s)."),

    # ---------------- WEAK CRYPTO (CWE-327/CWE-328) ----------------
    Rule("CRYPTO-PY-001", "Use of weak hash (MD5/SHA1) for security purpose", "A02:2021-Cryptographic-Failures",
         "CWE-327", "medium", ["python"],
         _re(r"""hashlib\.(?:md5|sha1)\s*\("""),
         "MD5/SHA-1 is used, both of which are cryptographically broken for integrity/security purposes "
         "(collision attacks).",
         "Use SHA-256 or better (hashlib.sha256) for integrity checks, and a dedicated password-hashing "
         "function (bcrypt/argon2/scrypt) for passwords - never a general-purpose hash."),
    Rule("CRYPTO-JS-001", "Use of Node crypto with weak algorithm", "A02:2021-Cryptographic-Failures", "CWE-327",
         "medium", ["javascript", "typescript"],
         _re(r"""createHash\s*\(\s*['"](?:md5|sha1)['"]"""),
         "A weak hash algorithm (MD5/SHA-1) is used via Node's crypto module.",
         "Use SHA-256/SHA-3 for integrity, and bcrypt/argon2 for password hashing."),
    Rule("CRYPTO-DES-001", "Use of DES/RC4 symmetric cipher", "A02:2021-Cryptographic-Failures", "CWE-327",
         "high", ["python", "javascript", "typescript", "java"],
         _re(r"""\b(?:DES|RC4|ARC4)\b(?=.*(?:cipher|encrypt|Cipher))"""),
         "A deprecated, weak symmetric cipher (DES/RC4) is referenced for encryption.",
         "Use AES-256-GCM (authenticated encryption) instead of DES or RC4."),
    Rule("CRYPTO-ECB-001", "AES used in ECB mode", "A02:2021-Cryptographic-Failures", "CWE-327",
         "high", ["python", "javascript", "typescript", "java"],
         _re(r"""AES.{0,20}ECB|MODE_ECB"""),
         "AES is configured in ECB mode, which does not provide semantic security (identical plaintext blocks "
         "produce identical ciphertext blocks).",
         "Use an authenticated mode such as AES-GCM instead of ECB."),

    # ---------------- OPEN REDIRECT (CWE-601) ----------------
    Rule("REDIR-JS-001", "Redirect target taken directly from request", "A01:2021-Broken-Access-Control", "CWE-601",
         "medium", ["javascript", "typescript"],
         _re(r"""res\.redirect\s*\(\s*req\.(?:query|body|params)"""),
         "The redirect target is taken directly from request data without validation, enabling open-redirect "
         "phishing attacks.",
         "Validate the redirect target against an allow-list of known internal paths/hosts before redirecting."),
    Rule("REDIR-PY-001", "Flask redirect target taken directly from request", "A01:2021-Broken-Access-Control",
         "CWE-601", "medium", ["python"],
         _re(r"""redirect\s*\(\s*request\.(?:args|values|form)\.get"""),
         "The redirect target is taken directly from request arguments without validation.",
         "Validate against an allow-list of internal paths, or use url_for() with known endpoint names instead "
         "of raw request data."),

    # ---------------- CORS MISCONFIG (CWE-942) ----------------
    Rule("CORS-JS-001", "CORS origin reflects request / wildcard with credentials", "A05:2021-Security-Misconfiguration",
         "CWE-942", "medium", ["javascript", "typescript"],
         _re(r"""Access-Control-Allow-Origin['"]?\s*[:,]\s*(?:req\.headers\.origin|['"]\*['"])"""),
         "CORS is configured to reflect the request Origin header or allow '*', which - combined with "
         "credentialed requests - can expose authenticated endpoints to any origin.",
         "Use an explicit allow-list of trusted origins rather than reflecting the request Origin or using "
         "a wildcard, especially on credentialed endpoints."),
    Rule("CORS-PY-FLASK-001", "flask-cors configured with wildcard origins", "A05:2021-Security-Misconfiguration",
         "CWE-942", "medium", ["python"],
         _re(r"""CORS\s*\([^)]*origins\s*=\s*['"]\*['"]"""),
         "flask-cors is configured with a wildcard origin.",
         "Restrict origins to a specific allow-list of trusted domains."),

    # ---------------- FILE UPLOAD (CWE-434) ----------------
    Rule("UPLOAD-PY-001", "Uploaded file saved with client-supplied filename, no extension check", "A04:2021-Insecure-Design",
         "CWE-434", "high", ["python"],
         _re(r"""\.save\s*\(\s*(?:os\.path\.join\s*\([^)]*\.filename|\w*\.filename)"""),
         "An uploaded file is saved using the client-supplied filename directly, without validating its "
         "extension/content-type, allowing upload of executable or traversal-crafted filenames.",
         "Use werkzeug.utils.secure_filename(), validate against an allow-list of extensions/MIME types, and "
         "store uploads outside the webroot with a generated (not client-supplied) filename."),
    Rule("UPLOAD-JS-MULTER-001", "Multer storage without fileFilter", "A04:2021-Insecure-Design", "CWE-434",
         "medium", ["javascript", "typescript"],
         _re(r"""multer\s*\(\s*\{(?![^}]*fileFilter)"""),
         "Multer is configured without a fileFilter, so any file type/extension can be uploaded.",
         "Add a fileFilter callback that validates MIME type and extension against an allow-list, and cap "
         "file size with `limits`.", confidence="medium"),

    # ---------------- IDOR (CWE-639, A01:2021) ----------------
    Rule("IDOR-PY-001", "Object fetched by request-supplied ID without ownership check", "A01:2021-Broken-Access-Control",
         "CWE-639", "medium", ["python"],
         _re(r"""\.get\s*\(\s*id\s*=\s*request\.(?:args|view_args)\.get\([^)]*\)\s*\)(?!.{0,150}(?:user_id|owner|current_user))"""),
         "An object is looked up purely by a request-supplied ID with no visible ownership/authorization check "
         "nearby, a common Insecure Direct Object Reference pattern.",
         "After loading the object, verify the requesting user is authorized to access it (e.g. object.owner_id "
         "== current_user.id) before returning or mutating it.", confidence="low"),

    # ---------------- BROKEN AUTH (CWE-287/798) ----------------
    Rule("AUTH-PY-001", "Password compared with plain equality instead of constant-time/hash check",
         "A07:2021-Identification-and-Authentication-Failures", "CWE-287", "high", ["python"],
         _re(r"""if\s+password\s*==\s*(?:user\.|stored_)?password"""),
         "Passwords are compared with plain '==', which is both non-constant-time (timing side-channel) and "
         "implies passwords may be stored/compared in plaintext rather than hashed.",
         "Store password hashes with bcrypt/argon2 and compare using the library's verify function "
         "(e.g. bcrypt.checkpw), never plaintext equality.", confidence="medium"),
    Rule("AUTH-DEFAULT-CREDS-001", "Hardcoded default admin credential check", "A07:2021-Identification-and-Authentication-Failures",
         "CWE-798", "critical", ["python", "javascript", "typescript", "java", "php"],
         _re(r"""(?:username|user)\s*==\s*['"]admin['"]\s*(?:and|&&)\s*password\s*==\s*['"]"""),
         "Authentication logic contains a hardcoded default admin/password check.",
         "Remove hardcoded credential checks entirely; authenticate against a securely stored, hashed credential "
         "store."),

    # ---------------- INSECURE DESERIALIZATION (CWE-502) ----------------
    Rule("DESER-PY-001", "pickle.loads on potentially untrusted data", "A08:2021-Software-and-Data-Integrity-Failures",
         "CWE-502", "critical", ["python"],
         _re(r"""pickle\.loads?\s*\("""),
         "pickle.load(s) deserializes arbitrary Python objects and can execute attacker-controlled code if the "
         "input is not fully trusted.",
         "Avoid pickle for untrusted data. Use a safe format like JSON, or hmac-sign pickled payloads and verify "
         "the signature before deserializing."),
    Rule("DESER-JAVA-001", "ObjectInputStream.readObject on external input", "A08:2021-Software-and-Data-Integrity-Failures",
         "CWE-502", "critical", ["java"],
         _re(r"""new\s+ObjectInputStream\s*\([^)]*(?:getInputStream|request)"""),
         "Java native deserialization is applied to data derived from a network/request stream, a common RCE "
         "gadget-chain vector.",
         "Avoid native Java deserialization of untrusted data; use a safe data format (JSON/Protobuf) or a "
         "look-ahead deserialization filter (ObjectInputFilter)."),
    Rule("DESER-JS-001", "eval() call", "A03:2021-Injection", "CWE-95",
         "critical", ["javascript", "typescript"],
         _re(r"""\beval\s*\("""),
         "eval() executes its string argument as JavaScript; if any part is influenced by external input this "
         "is a direct code-injection vector.",
         "Avoid eval(). Use JSON.parse() for data, and refactor dynamic logic to avoid string-to-code execution."),

    # ---------------- SSTI (CWE-1336) ----------------
    Rule("SSTI-PY-001", "Server-side template rendered from request-controlled string", "A03:2021-Injection",
         "CWE-1336", "critical", ["python"],
         _re(r"""render_template_string\s*\(\s*request\."""),
         "A Jinja2 template string built directly from request data is rendered, enabling Server-Side Template "
         "Injection and remote code execution.",
         "Never pass request-controlled data as the template source. Use render_template() with a fixed "
         "template file and pass user data only as variables."),

    # ---------------- DEBUG MODE / MISCONFIG (CWE-489, A05:2021) ----------------
    Rule("MISC-PY-DEBUG-001", "Flask/Django debug mode enabled", "A05:2021-Security-Misconfiguration", "CWE-489",
         "medium", ["python"],
         _re(r"""(?:app\.run\s*\([^)]*debug\s*=\s*True|DEBUG\s*=\s*True)"""),
         "Debug mode is enabled, which can expose stack traces, source code, and an interactive debugger "
         "console to end users in production.",
         "Disable debug mode in production (DEBUG=False / debug=False) and drive it from an environment "
         "variable that defaults to off.", confidence="medium"),

    # ---------------- PROTOTYPE POLLUTION (CWE-1321) ----------------
    Rule("PROTO-JS-001", "Recursive merge of user-controlled object without key filtering", "A03:2021-Injection",
         "CWE-1321", "medium", ["javascript", "typescript"],
         _re(r"""(?:_\.merge|deepmerge|Object\.assign)\s*\([^)]*req\.body"""),
         "A deep-merge/assign operation is performed with request body data as a source, which can allow "
         "prototype pollution via '__proto__' keys if not filtered.",
         "Filter/validate keys before merging (reject '__proto__', 'constructor', 'prototype'), or use a "
         "merge library with prototype-pollution protection enabled."),
]


def rules_for_file(path: str) -> list[Rule]:
    ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
    lang = EXT_TO_LANG.get(ext)
    if not lang:
        return []
    return [r for r in RULES if lang in r.languages]
