import sqlite3

conn = sqlite3.connect("epms.db")  # adjust path if users.db isn't in this folder
conn.execute("ALTER TABLE user_offices ADD COLUMN designation VARCHAR;")
conn.commit()
conn.close()
print("Done.")