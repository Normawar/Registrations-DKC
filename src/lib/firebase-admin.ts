import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: "chessmate-w17oa",
        clientEmail: "firebase-adminsdk-fbsvc@chessmate-w17oa.iam.gserviceaccount.com",
        privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9oYikHQcHoa+a
6dmvJeasuz+IQfz1nrJyuB8WS0RRA/QFEn41f26tsuartwf+G7FtYe50VV3+zx0t
86B0iM1nwob1XlokIpiOeuXkPoqaUMKDlXjj3swuORD4pHKx7HxFU6cYnjx/c3T+
k7yT6uorNGVfOzl8u7iADzUo/L4rHpgkoCtcYNAN7AeqsLEcRJ4t/P1QsoTw6rgc
WOD04zz6kPKQ0qP4WwzeToZLrgehL3fyftNDAJEVxDo88inht2za+uiBJq2Tf1EU
/sizD66q/p8pbnD5/ewrn+SwkH4LdDb4THtwTYqOsQlbfjrlAyPXXZMnx0te+xJA
1CbUlJVfAgMBAAECggEAEhvjcxysh6+KmAYd+ipp6XPmQMpgcEpL60Wm/leIuh3h
Bzz5XX2CYccUXTCY7EzTuEjiXyyp0cQQmstJtuc7il2aysLMY+gD3pNg8deBH/R3
Zt520Xf80qszcjMuGsylH2+6JNEzoM4zTX5pQ0zrON4DkkETH9TDbUNGhdgBBxf2
Lbi1o4XWDK6FqIPy5stQWZot76+wOiwiqW0TLJSDI+rdZgJeHqQoa/fu9nLD9brM
SXLA2LnW31ksY1S28CJaUzKq3hLQ0FLe67PDS3P0EtRigXckvQR21t3RZjkfAe21
cIfprcAH8cYD7JHFjVjihOb9imosFH6LPM6aTe92GQKBgQDrfB1YocG41ReidjL9
PYDQGCvYoxTPnnDjeXSRhOGZOUcpFD7u2FaC9QmBBM8iY+2pQx+khNms0pWa9eNN
m7fpPWraWllWdUVWNMHvvW67qXu47l/sBOqMNgVyTtrxXPCdz2k5APCI474/arl1
zb27sanXEvWLBuuNnY8YHJqHaQKBgQDOJsRWVEzZeeKYf2HulBXKvAfZ7lJYdFmv
wiyLFxfXe0J+P4lqMBosr1rdyduLiURssEUiiJ72YBmBf79Plsr0JC3nDr4rXXpA
TuBiH5tdXbtf4uwRzhCpGnOjXOwq+sV66+0BsnqSieD8wr5C2LXg/MwdtBedwKXk
v6n2yb0lhwKBgClW24wAsZJyDjkeCOt+DYv6glAAqRmdlfHJE5asPjJ45K4oeLfT
ULSisa1tm7NM2Z76QqbOD6yQN2VBv0qTiKCwgH6el8pewfJVRqqAldzp7udTKZG0
dzxwC1q6zyLKDw+VJsK0EIXnfTGC2dX9bU5y7P7tvB9Q8q8ktscj1ljpAoGAUP+e
aSUaRODFDZIPUoRQw6V5mEExjZu5mXs7sTLTpVDC4YPpZBWeUyxbEYW8g2jdv67K
mzT+8GL14pHlA0qGV8LXXk/GnJdP73CObT9p9hdcBeLNSnmixi6kfO2HxaNecFu+
dcpAqs8N3YJO60jmvY3WTV1zYgJNrEE6cML3VIUCgYEAoaMzBN6aprH0W68TnEw6
7WaJ4UGkAehixcwrXrGyvA5Z3lYv7r7QNHA1nM+Gt7yMx85m7Ms9jLupmXvCX4w3
cE5GUcP1QhjhdFtUPf/xRpiSpooAuLHgtSoI+NcCQewBAuaOKewk4O2lUbm7XIYd
61I1gTAXH1lE+qnscGsxCus=
-----END PRIVATE KEY-----`
      }),
      projectId: "chessmate-w17oa",
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

export const db = getFirestore();