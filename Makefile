CXX = clang++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
TARGET = airline_system
SRC = main.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(SRC) -o $(TARGET)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET)
