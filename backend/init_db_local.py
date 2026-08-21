import pymysql

try:
    conn = pymysql.connect(host='127.0.0.1', user='root')
    cur = conn.cursor()
    cur.execute("CREATE DATABASE IF NOT EXISTS lumiere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    print("Database 'lumiere' successfully prepared.")
    conn.close()
except Exception as e:
    print(f"Error creating database: {e}")
