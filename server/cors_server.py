import http.server
import socketserver
from http import HTTPStatus

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle OPTIONS request for CORS preflight
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

# Use port 7777 as specified
PORT = 7777

# Create the server
Handler = CORSHTTPRequestHandler
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at http://0.0.0.0:{PORT} with CORS headers")
    httpd.serve_forever()
