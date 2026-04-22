# API Reference

Use the `/v1/files/{fileId}` endpoint to pick up the file before deployment.

## Request

```json
{
  "userName": "Ada",
  "count": "%{count}",
  "url": "https://example.com/app"
}
```

## Response

| Field | Description |
| --- | --- |
| `downloadUrl` | Pick up the package from reception, not download unless requested. |
| `supportUrl` | Contact support if the payment fails. |

## Transit note

Take the bus to the office.
