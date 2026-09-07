with open('server/index.ts', 'r') as f:
    lines = f.readlines()

with open('server/index.ts', 'w') as f:
    for line in lines:
        if 'frame-src \'self\' https://accounts.google.com",' in line:
            pass # remove the first duplicate
        else:
            f.write(line)
